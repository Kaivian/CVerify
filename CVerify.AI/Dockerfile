# ==============================================================================
# CVERIFY AI FastAPI MICROSERVICE PRODUCTION DOCKERFILE
# ==============================================================================
# Multi-stage, virtualenv, non-root execution, BuildKit cached.
# ==============================================================================

# 1. Builder stage
FROM python:3.11.11-slim-bookworm AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Build-time system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment to isolate dependencies cleanly
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
# Cache pip downloads using BuildKit cache mount
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

# 2. Runner stage
FROM python:3.11.11-slim-bookworm AS runner

WORKDIR /app

# Install runtime dependencies and curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-vie \
    libgl1 \
    libglib2.0-0 \
    poppler-utils \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create non-root system user
RUN groupadd -g 10001 appuser && \
    useradd -r -u 10001 -g appuser appuser

# Pre-create clone directory and set ownership to allow git cloning inside container
RUN mkdir -p /app/temp_clones && \
    chown -R appuser:appuser /app

# Copy virtual environment and app files with correct ownership
COPY --from=builder --chown=appuser:appuser /opt/venv /opt/venv
COPY --chown=appuser:appuser app/ app/

# Environment configurations
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=5s --timeout=5s --retries=5 --start-period=5s \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
