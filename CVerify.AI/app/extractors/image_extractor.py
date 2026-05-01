"""
Image → Markdown extractor for candidate certificates (PNG, JPG, WEBP, etc.).

Strategy (two-tier):
  Tier 1 — MarkItDown with pytesseract  (fast, free, offline OCR).
            Used when the image contains clearly printed text, which is the
            common case for digital certificates (AWS, Google, Coursera, …).

  Tier 2 — MarkItDown with Claude Vision  (accurate, handles complex layouts).
            Activated only when ENABLE_VISION_CERTIFICATE_OCR=true is set in
            the environment AND a valid ANTHROPIC_API_KEY is present.
            Uses claude-3-haiku for cost efficiency (much cheaper than Sonnet).

Token-saving rationale
  Raw OCR text from certificates tends to be noisy (spaces, artefacts).
  MarkItDown post-processes the output into clean Markdown so the downstream
  prompt receives compact, structured text rather than a raw dump.
"""

import io
import os
import logging

from app.extractors.text_extractor import ITextExtractor

logger = logging.getLogger(__name__)

# Supported image MIME types / extensions
SUPPORTED_EXTENSIONS = {
    b"\x89PNG": ".png",
    b"\xff\xd8\xff": ".jpg",
    b"RIFF": ".webp",   # WebP starts with RIFF....WEBP
    b"GIF8": ".gif",
    b"\x42\x4d": ".bmp",
}


def _detect_extension(data: bytes) -> str:
    """Sniff the image format from the first bytes and return a file extension."""
    for magic, ext in SUPPORTED_EXTENSIONS.items():
        if data[:len(magic)] == magic:
            return ext
    return ".png"  # safe default


class ImageTextExtractor(ITextExtractor):
    """
    Extracts text from certificate images (PNG, JPG, WEBP, …) and returns
    clean Markdown.

    Usage:
        extractor = ImageTextExtractor()
        markdown = await extractor.extract_async(image_bytes)

    Environment variables:
        ENABLE_VISION_CERTIFICATE_OCR  – set to "true" to activate Claude Vision
                                         fallback (Tier 2). Default: false.
        ANTHROPIC_API_KEY              – required for Tier 2.
    """

    async def extract_async(self, file_content: bytes) -> str:
        if not file_content:
            return ""

        try:
            from markitdown import MarkItDown  # type: ignore[import]
        except ImportError:
            logger.warning(
                "markitdown is not installed. "
                "Run `pip install markitdown[all]` to enable image/certificate extraction."
            )
            return ""

        file_ext = _detect_extension(file_content)
        stream = io.BytesIO(file_content)

        # ── Tier 1: pytesseract OCR (no network, no cost) ──────────────────
        try:
            md_converter = MarkItDown()
            result = md_converter.convert(stream, file_extension=file_ext)
            text: str = (result.text_content or "").strip()

            if text:
                logger.debug(
                    "Image Tier-1 (pytesseract) extraction OK. "
                    "Input bytes: %d | Output chars: %d",
                    len(file_content),
                    len(text),
                )
                return text

            logger.debug(
                "Tier-1 pytesseract returned empty text for image (%d bytes). "
                "Checking Tier-2 availability.",
                len(file_content),
            )
        except Exception as tier1_err:
            logger.warning("Image Tier-1 extraction failed: %s", tier1_err)

        # ── Tier 2: Claude Vision (optional, environment-gated) ────────────
        vision_enabled = os.getenv("ENABLE_VISION_CERTIFICATE_OCR", "false").lower() == "true"
        api_key = os.getenv("ANTHROPIC_API_KEY", "")

        if not vision_enabled:
            logger.debug(
                "Tier-2 vision OCR is disabled. "
                "Set ENABLE_VISION_CERTIFICATE_OCR=true to enable."
            )
            return ""

        if not api_key or api_key == "your_anthropic_api_key_here":
            logger.warning("Tier-2 vision OCR enabled but ANTHROPIC_API_KEY is not set.")
            return ""

        try:
            import anthropic  # type: ignore[import]
            import base64

            # Re-read stream from beginning
            stream.seek(0)
            image_b64 = base64.standard_b64encode(stream.read()).decode("utf-8")

            # Map file extension to IANA media type
            media_type_map = {
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".webp": "image/webp",
                ".gif": "image/gif",
                ".bmp": "image/bmp",
            }
            media_type = media_type_map.get(file_ext, "image/png")

            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-3-haiku-20240307",   # cheapest vision model
                max_tokens=1024,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": image_b64,
                                },
                            },
                            {
                                "type": "text",
                                "text": (
                                    "This is a professional certificate or credential image. "
                                    "Extract all visible text exactly as it appears. "
                                    "Format the output as clean Markdown. "
                                    "Preserve certificate name, issuing organisation, "
                                    "candidate name, date, and any credential IDs. "
                                    "Return only the extracted text — no commentary."
                                ),
                            },
                        ],
                    }
                ],
            )

            vision_text: str = ""
            for block in response.content:
                if hasattr(block, "text"):
                    vision_text += block.text

            vision_text = vision_text.strip()
            logger.info(
                "Image Tier-2 (Claude Vision) extraction OK. "
                "Input bytes: %d | Output chars: %d",
                len(file_content),
                len(vision_text),
            )
            return vision_text

        except Exception as tier2_err:
            logger.error("Image Tier-2 (Claude Vision) extraction failed: %s", tier2_err)
            return ""
