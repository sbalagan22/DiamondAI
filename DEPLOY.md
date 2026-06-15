# Deploy

Two services, wired by one env var (`INFERENCE_URL`):

- **Hugging Face Spaces** — Python FastAPI inference server (CPU JAX), built from the repo [`Dockerfile`](Dockerfile).
  Free CPU tier is **2 vCPU / 16 GB RAM**, which fixes the Render 512 MB OOM. Serves on **port 7860**.
- **Vercel** — Next.js frontend in [`web/`](web/).

> We switched off Render; `render.yaml` was deleted. The build is self-contained: the step-6000 Orbax
> checkpoint (`6000/`, ~29 MB) and `data/tokenized/{vocab.json,players.json}` are committed to git and
> `COPY`'d into the image — the server loads them on boot, so they MUST be present in the Space repo.

## 1. Hugging Face Space (inference server)

1. Create a free HF account (no card): https://huggingface.co/join
2. **New Space** → name it `diamondai-inference` → **SDK: Docker** → blank template → Create.
   Choosing Docker scaffolds the Space's `README.md` with the required front-matter (see step 4).
3. Add the Space as a git remote of this repo and push `main` to it:
   ```bash
   git remote add space https://huggingface.co/spaces/<user>/diamondai-inference
   git push space main
   ```
   You'll authenticate with an HF access token (Settings → Access Tokens → write) as the password.
   This pushes the `Dockerfile`, `src/`, `6000/`, and `data/tokenized/*.json` — everything the build needs.
4. **README front-matter (required).** HF reads `README.md` at the Space repo root; it must START with
   this YAML block (also saved as [`README-hf-space.md`](README-hf-space.md)):
   ```
   ---
   title: DiamondAI Inference
   emoji: ⚾
   colorFrom: blue
   colorTo: red
   sdk: docker
   app_port: 7860
   pinned: false
   ---
   ```
   Pushing this repo overwrites the Space's `README.md` with our project README (no front-matter), so
   after the push **edit the Space's `README.md` in the HF web editor and paste the block at the very top**
   (or commit it on the `space` remote). Without it the Space won't build as a Docker app.
5. The Space builds the Docker image (a few minutes — JAX install). Wait for status **Running**.
   URL: `https://<user>-diamondai-inference.hf.space`.
   Sanity check: `https://<user>-diamondai-inference.hf.space/health` → `{"ok": true, "step": 6000}`.

### Large files (only if HF rejects the push)
The checkpoint is ~29 MB, under HF's 10 GB-per-file limit, so plain git should work. If a large-file
push is rejected, track the checkpoint with Git LFS before pushing:
```bash
git lfs install
git lfs track "6000/**"
git add .gitattributes && git commit -m "Track checkpoint with LFS"
git push space main
```

## 2. Vercel (frontend)

1. Vercel dashboard → **Add New → Project**, import this GitHub repo.
2. **Set Root Directory = `web`** (critical — the Next.js app lives in the subdirectory).
   Framework auto-detects as Next.js; leave build/output defaults.
3. Add an environment variable:
   - `INFERENCE_URL` = the Space URL from step 1.5 (e.g. `https://<user>-diamondai-inference.hf.space`).
   It is read server-side in [`web/lib/mlbConfig.ts`](web/lib/mlbConfig.ts) and consumed by the
   `/api/model-status` and `/api/game/[gamePk]` route handlers. No `NEXT_PUBLIC_` prefix — never exposed to the client.
4. Deploy.

## 3. (Optional) Lock down CORS

Calls are server-to-server, so CORS is belt-and-suspenders. To restrict it: add a `CORS_ALLOW_ORIGINS`
variable to the Space (Settings → Variables) set to your Vercel domain, and restart the Space.

## Free-tier behavior (expected, not a bug)

The free Space **sleeps after inactivity** and cold-starts on the next request (~30–60s while it wakes
and JIT-compiles). During that window the game route's inference fetch times out and the frontend shows
the **`sim.ts` fallback + "model offline" badge** — the site never looks broken; real predictions appear
once the Space is warm. The 16 GB tier means it should not OOM like Render's 512 MB did.

## Local sanity check

```bash
# Inference server on the Spaces port (7860), same as the Docker CMD:
JAX_PLATFORMS=cpu .venv/bin/uvicorn src.serve.app:app --host 0.0.0.0 --port 7860
curl localhost:7860/health        # -> {"ok": true, "step": 6000}

# Or build the image exactly as HF does (needs Docker):
docker build -t diamondai-inference .
docker run -p 7860:7860 diamondai-inference

# Frontend (from web/):
cd web && npm run build && npm run dev   # INFERENCE_URL defaults to localhost:8000 for dev
```

Local data-collection / test deps (not needed to serve): `pip install -r requirements-dev.txt`.
