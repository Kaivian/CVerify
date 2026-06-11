# ==============================================================================
# CVERIFY AI FastAPI MICROSERVICE DOCKERFILE
# ==============================================================================

FROM python:3.11-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Build-time system dependencies
# - build-essential : compiles any C-extension Python packages
# - git             : required by some pip packages that pull from VCS
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ==============================================================================
# Final minimal runner stage
# ==============================================================================
FROM python:3.11-slim AS runner

WORKDIR /app

# ---------------------------------------------------------------------------
# Runtime system dependencies
#
# tesseract-ocr           – Tesseract OCR engine (required by markitdown[all]
#                           and pytesseract for certificate image extraction)
# tesseract-ocr-eng       – English language pack (covers most certificates)
# tesseract-ocr-vie       – Vietnamese language pack (for local certificates)
# libgl1 / libglib2.0-0   – OpenCV/Pillow shared libs used by markitdown
# poppler-utils           – pdfinfo / pdfimages (optional PDF quality check)
# ---------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-vie \
    libgl1 \
    libglib2.0-0 \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.local /root/.local
COPY app/ app/

ENV PATH=/root/.local/bin:$PATH
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Tesseract data directory (auto-detected by pytesseract on Debian/Ubuntu)
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
