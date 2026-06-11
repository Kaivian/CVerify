"""
Generic OCR extractor — delegates to ImageTextExtractor.

Kept for backward-compatibility so any code that instantiates OcrTextExtractor
continues to work without changes.  The actual extraction logic (2-tier
pytesseract → Claude Vision) lives in image_extractor.py.
"""

from app.pipelines.shared.extractors.text_extractor import ITextExtractor
from app.pipelines.shared.extractors.image_extractor import ImageTextExtractor


class OcrTextExtractor(ITextExtractor):
    """
    Thin wrapper around ImageTextExtractor.
    Accepts raw image bytes (PNG, JPG, WEBP, …) and returns Markdown text.
    """

    def __init__(self) -> None:
        self._delegate = ImageTextExtractor()

    async def extract_async(self, file_content: bytes) -> str:
        return await self._delegate.extract_async(file_content)
