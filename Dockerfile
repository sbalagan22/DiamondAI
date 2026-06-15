# DiamondAI inference server — Hugging Face Spaces (Docker SDK, free CPU tier).
# Serves FastAPI on port 7860 (Spaces requirement). CPU JAX only — no TPU/libtpu.
FROM python:3.12-slim

# Memory/thread-conservative flags for CPU JAX. Set as ENV so they are live before
# app.py imports jax (app.py also setdefault's the first two; explicit ENV wins).
ENV JAX_PLATFORMS=cpu \
    XLA_PYTHON_CLIENT_PREALLOCATE=false \
    XLA_PYTHON_CLIENT_ALLOCATOR=platform \
    OMP_NUM_THREADS=2 \
    INFERENCE_CKPT=6000 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install CPU deps first for layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Full src/ package: app.py's import chain pulls serve + model + data + eval + train,
# so copying only serve/model/data would crash on boot. Plus the trained checkpoint
# and the two data files the server loads at startup (vocab + player index).
COPY src/ ./src/
COPY 6000/ ./6000/
COPY data/tokenized/vocab.json ./data/tokenized/vocab.json
COPY data/tokenized/players.json ./data/tokenized/players.json

EXPOSE 7860
CMD ["uvicorn", "src.serve.app:app", "--host", "0.0.0.0", "--port", "7860"]
