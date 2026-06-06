from app.extractors.text_extractor import ITextExtractor


class OcrTextExtractor(ITextExtractor):
    async def extract_async(self, file_content: bytes) -> str:
        # Implementation will go here - Tesseract/Azure OCR
        return ""
