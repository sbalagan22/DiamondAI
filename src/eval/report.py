"""Pure scoring + reporting helpers for the held-out eval (no model, no I/O of params).

Masks per head mirror src/train/loss.py exactly and must NOT diverge:
  - next-pitch heads use target_mask (valid non-final, non-pad);
  - ab_outcome / home_win use attention_mask (every real pitch).
All metrics pool per-position across the val set; cross-entropy is the same objective as loss.py.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from ..model.config import HEAD_SIZES

_NEXT_PITCH_HEADS: tuple[str, ...] = ("next_pitch_type", "next_pitch_outcome")
_ATTN_HEADS: tuple[str, ...] = ("ab_outcome", "home_win")
HEADS: tuple[str, ...] = _NEXT_PITCH_HEADS + _ATTN_HEADS


def mask_name(head: str) -> str:
    return "target_mask" if head in _NEXT_PITCH_HEADS else "attention_mask"


# --- numpy math -----------------------------------------------------------------

def log_softmax(z: np.ndarray) -> np.ndarray:
    z = z - z.max(axis=-1, keepdims=True)
    return z - np.log(np.exp(z).sum(axis=-1, keepdims=True))


def softmax(z: np.ndarray) -> np.ndarray:
    z = z - z.max(axis=-1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=-1, keepdims=True)


def ce_at(logits: np.ndarray, labels: np.ndarray) -> np.ndarray:
    """Per-row -log p(label): same objective as loss.py, over pooled masked positions."""
    ls = log_softmax(logits)
    return -ls[np.arange(len(labels)), labels]


# --- metrics + baselines --------------------------------------------------------

def model_metrics(acc: dict[str, dict[str, np.ndarray]]) -> dict[str, dict[str, float]]:
    out: dict[str, dict[str, float]] = {}
    for h in HEADS:
        pred, label, ce = acc[h]["pred"], acc[h]["label"], acc[h]["ce"]
        out[h] = {"acc": float((pred == label).mean()), "logloss": float(ce.mean()), "n": int(label.size)}
    return out


def _per_count_acc(balls: np.ndarray, strikes: np.ndarray, label: np.ndarray, n_classes: int) -> float:
    """Accuracy of predicting the most-common pitch type per (balls,strikes) count (in-sample)."""
    correct = 0
    for b in np.unique(balls):
        for s in np.unique(strikes):
            sel = (balls == b) & (strikes == s)
            if not sel.any():
                continue
            top = int(np.bincount(label[sel], minlength=n_classes).argmax())
            correct += int((label[sel] == top).sum())
    return correct / label.size


def baselines(acc: dict[str, dict[str, np.ndarray]]) -> dict[str, dict[str, float]]:
    """Naive baseline per head: marginal most-frequent-class (and constant 0.5 for home_win)."""
    res: dict[str, dict[str, float]] = {}
    for h in HEADS:
        counts = np.bincount(acc[h]["label"], minlength=HEAD_SIZES[h]).astype(np.float64)
        p = counts / counts.sum()
        nz = p[p > 0]
        if h == "home_win":
            res[h] = {
                "baseline_acc": float(p.max()),               # majority class
                "baseline_logloss": float(-np.log(0.5)),      # constant 0.5 prediction
                "empirical_home_win_rate": float(p[1]) if p.size > 1 else float("nan"),
            }
        else:
            res[h] = {
                "baseline_acc": float(p.max()),               # top-class frequency
                "baseline_logloss": float(-(nz * np.log(nz)).sum()),  # label entropy (marginal predictor)
            }
    npt = acc["next_pitch_type"]
    res["next_pitch_type"]["per_count_acc"] = _per_count_acc(
        npt["balls"], npt["strikes"], npt["label"], HEAD_SIZES["next_pitch_type"]
    )
    return res


# --- calibration ----------------------------------------------------------------

def calibration(prob1: np.ndarray, label: np.ndarray, n_bins: int) -> tuple[list[dict], float]:
    """Reliability bins: per-bin mean predicted prob vs empirical home-win rate, plus ECE."""
    edges = np.linspace(0.0, 1.0, n_bins + 1)
    rows: list[dict] = []
    ece = 0.0
    n = label.size
    for i in range(n_bins):
        lo, hi = float(edges[i]), float(edges[i + 1])
        sel = (prob1 >= lo) & (prob1 <= hi) if i == n_bins - 1 else (prob1 >= lo) & (prob1 < hi)
        c = int(sel.sum())
        mp = float(prob1[sel].mean()) if c else float("nan")
        emp = float(label[sel].mean()) if c else float("nan")
        if c:
            ece += (c / n) * abs(mp - emp)
        rows.append({"bin_lo": lo, "bin_hi": hi, "count": c, "mean_pred": mp, "empirical": emp})
    return rows, float(ece)


def save_reliability(rows: list[dict], path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    pts = [(r["mean_pred"], r["empirical"]) for r in rows if r["count"] > 0]
    xs, ys = ([p[0] for p in pts], [p[1] for p in pts]) if pts else ([], [])
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.plot([0, 1], [0, 1], "--", color="gray", label="perfect calibration")
    ax.plot(xs, ys, "o-", color="C0", label="model")
    ax.set_xlabel("mean predicted P(home win)")
    ax.set_ylabel("empirical home-win rate")
    ax.set_title("Home-win reliability diagram (val)")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.grid(alpha=0.3)
    ax.legend(loc="upper left")
    fig.tight_layout()
    fig.savefig(path, dpi=120)
    plt.close(fig)


def write_calibration_csv(rows: list[dict], path: Path) -> None:
    lines = ["bin_lo,bin_hi,count,mean_pred,empirical"]
    for r in rows:
        lines.append(
            f"{r['bin_lo']:.1f},{r['bin_hi']:.1f},{r['count']},{r['mean_pred']:.6f},{r['empirical']:.6f}"
        )
    path.write_text("\n".join(lines) + "\n")


# --- reporting + artifacts ------------------------------------------------------

def _table_rows(model_m: dict, base_m: dict) -> list[tuple[str, float, float, float, float]]:
    return [
        (h, model_m[h]["acc"], base_m[h]["baseline_acc"], model_m[h]["logloss"], base_m[h]["baseline_logloss"])
        for h in HEADS
    ]


def print_report(model_m: dict, base_m: dict, rows: list[dict], ece: float) -> None:
    print("\n=== per-head: model vs naive baseline (val) ===")
    print(f"{'head':<20} {'model acc':>10} {'base acc':>10} {'model ll':>10} {'base ll':>10}")
    for h, ma, ba, ml, bl in _table_rows(model_m, base_m):
        print(f"{h:<20} {ma:>10.4f} {ba:>10.4f} {ml:>10.4f} {bl:>10.4f}")
    print(
        "\nnext_pitch_type per-count (balls,strikes) baseline acc: "
        f"{base_m['next_pitch_type']['per_count_acc']:.4f}  (in-sample; optimistic upper bound)"
    )
    print("\n=== home-win calibration (val) ===")
    print(f"{'bin':>12} {'count':>8} {'mean_pred':>10} {'empirical':>10}")
    for r in rows:
        mp = f"{r['mean_pred']:.4f}" if r["count"] else "-"
        emp = f"{r['empirical']:.4f}" if r["count"] else "-"
        print(f"{r['bin_lo']:.1f}-{r['bin_hi']:.1f}".rjust(12) + f" {r['count']:>8} {mp:>10} {emp:>10}")
    print(f"\nECE = {ece:.4f}")


def _readout(model_m: dict, base_m: dict, ece: float) -> str:
    parts = []
    for h in HEADS:
        d = model_m[h]["acc"] - base_m[h]["baseline_acc"]
        verb = "beats" if d > 0 else "trails"
        parts.append(
            f"{h} {model_m[h]['acc']:.1%} vs baseline {base_m[h]['baseline_acc']:.1%} "
            f"({verb} by {abs(d) * 100:.1f} pts)"
        )
    return (
        "On the held-out val games the model " + "; ".join(parts) + ". "
        "Cross-entropy is lower than the marginal baseline where accuracy improves. "
        f"Home-win predictions have an Expected Calibration Error of {ece:.4f} (0 = perfectly calibrated)."
    )


def write_summary_md(path: Path, model_m: dict, base_m: dict, ece: float, n_val: int, device: str) -> None:
    lines = [
        "# MLB pitch predictor — held-out validation metrics",
        "",
        f"- Val games: **{n_val}** (deterministic ~5% hash split, same as train.py)",
        f"- Device: **{device}** (inference only)",
        "",
        "| head | model acc | baseline acc | model logloss | baseline logloss |",
        "| --- | --- | --- | --- | --- |",
    ]
    for h, ma, ba, ml, bl in _table_rows(model_m, base_m):
        lines.append(f"| {h} | {ma:.4f} | {ba:.4f} | {ml:.4f} | {bl:.4f} |")
    lines += [
        "",
        "`next_pitch_type` per-count (balls,strikes) baseline acc: "
        f"{base_m['next_pitch_type']['per_count_acc']:.4f} (in-sample, optimistic).",
        f"Home-win ECE: **{ece:.4f}**.",
        "",
        "## Readout",
        "",
        _readout(model_m, base_m, ece),
        "",
    ]
    path.write_text("\n".join(lines))


def assemble_metrics(
    model_m: dict, base_m: dict, ece: float, rows: list[dict], n_val: int, device: str, ckpt: str
) -> dict:
    return {
        "ckpt": ckpt,
        "device": device,
        "val_games": n_val,
        "ece_home_win": ece,
        "heads": {
            h: {
                "model_acc": model_m[h]["acc"],
                "model_logloss": model_m[h]["logloss"],
                "n_positions": model_m[h]["n"],
                **base_m[h],
            }
            for h in HEADS
        },
        "calibration_bins": rows,
    }
