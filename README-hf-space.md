---
title: DiamondAI Inference
emoji: ⚾
colorFrom: blue
colorTo: red
sdk: docker
app_port: 7860
pinned: false
---

# DiamondAI Inference

FastAPI server (CPU JAX) that loads the trained step-6000 MLB pitch predictor and
serves next-pitch / outcome / win-prob predictions. Built from the repo `Dockerfile`.

**This YAML front-matter is what Hugging Face Spaces requires.** The Space reads
`README.md` at its repo root — make sure the block above is the very top of that
file. See `DEPLOY.md` for the full flow.
