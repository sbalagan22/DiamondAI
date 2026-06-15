# Deploy

Two services, wired by one env var (`INFERENCE_URL`):

- **Render** — Python FastAPI inference server (CPU JAX), defined by [`render.yaml`](render.yaml).
- **Vercel** — Next.js frontend in [`web/`](web/).

The committed step-6000 Orbax checkpoint (`6000/`) and `data/tokenized/{vocab.json,players.json}`
are what the server loads on boot — they are intentionally in git, so the deploy is self-contained.

## 1. Render (inference server)

1. Render dashboard → **New → Blueprint**.
2. Connect this GitHub repo. Render reads `render.yaml` and configures the `diamondai-inference`
   web service automatically (free plan, Python, `pip install -r requirements.txt`,
   `uvicorn ... --host 0.0.0.0 --port $PORT`, health check `/health`).
3. Click **Apply / Deploy**. First build takes a few minutes (JAX install).
4. When live, copy the service URL, e.g. `https://diamondai-inference.onrender.com`.
   Sanity check: `https://diamondai-inference.onrender.com/health` returns `{"ok": true, "step": 6000}`.

## 2. Vercel (frontend)

1. Vercel dashboard → **Add New → Project**, import this repo.
2. **Set Root Directory = `web`** (critical — the Next.js app lives in the subdirectory).
   Framework auto-detects as Next.js; leave build/output defaults.
3. Add an environment variable:
   - `INFERENCE_URL` = the Render URL from step 1.4 (e.g. `https://diamondai-inference.onrender.com`).
   It is read server-side in [`web/lib/mlbConfig.ts`](web/lib/mlbConfig.ts) and consumed by the
   `/api/model-status` and `/api/game/[gamePk]` route handlers. No `NEXT_PUBLIC_` prefix — never exposed to the client.
4. Deploy.

## 3. (Optional) Lock down CORS

Calls are server-to-server, so CORS is belt-and-suspenders. To restrict it anyway: in Render, set
`CORS_ALLOW_ORIGINS` to your Vercel domain (e.g. `https://your-app.vercel.app`) and redeploy.

## Free-tier behavior (expected, not a bug)

- The Render free instance **sleeps after ~15 min idle**. The first prediction after idle takes
  **~30–60s** while it wakes and JIT-compiles. During that window the game route's inference fetch
  times out and the frontend shows the **`sim.ts` fallback + "model offline" badge** — the site never
  looks broken, it just isn't showing the real model until the server is warm.
- **512 MB RAM** is tight for JAX + the model. The server sets memory-conservative flags
  (`JAX_PLATFORMS=cpu`, `XLA_PYTHON_CLIENT_PREALLOCATE=false`) and runs a single worker. If it still
  OOMs on boot, the fix is the **$7/mo Starter instance** (more RAM) — not a code change.

## Local sanity check

```bash
# Inference server (binds $PORT like Render does):
JAX_PLATFORMS=cpu PORT=8000 .venv/bin/uvicorn src.serve.app:app --host 0.0.0.0 --port $PORT
curl localhost:8000/health        # -> {"ok": true, "step": 6000}

# Frontend (from web/):
cd web && npm run build && npm run dev   # http://localhost:3000, INFERENCE_URL defaults to localhost:8000
```

Local data-collection / test deps (not needed to serve): `pip install -r requirements-dev.txt`.
