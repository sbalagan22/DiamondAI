"""Thin Kaggle entrypoint — paste into a cell or `%run notebooks/train_kaggle.py`.

Imports the real training loop from `src/` and runs a full data-parallel run over the
Kaggle TPU mesh. Paths default to the Kaggle layout; override by passing CLI args
(e.g. `%run notebooks/train_kaggle.py --steps 80000 --batch-size 128`).
"""

from __future__ import annotations

import sys
from pathlib import Path

# Make `src/` importable whether run as a script or via %run from a notebook cell.
ROOT = Path(__file__).resolve().parents[1] if "__file__" in globals() else Path.cwd()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.train.train import main

DATA_DIR = "/kaggle/input/mlb-tokenized"
OUT_DIR = "/kaggle/working/checkpoints"

if __name__ == "__main__":
    argv = sys.argv[1:] or [
        "--data-dir", DATA_DIR,
        "--out-dir", OUT_DIR,
        "--batch-size", "64",
        "--steps", "50000",
    ]
    main(argv)
