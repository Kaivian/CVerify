"""
DOCX → Markdown extractor powered by Microsoft MarkItDown.

Word documents uploaded as CVs or certificates are converted to structured
Markdown, preserving headings, lists, and tables — producing a compact,
token-efficient representation for downstream Claude prompts.
"""

import io
import logging

from app.extractors.text_extractor import ITextExtractor

logger = logging.getLogger(__name__)


class DocxTextExtractor(ITextExtractor):
    """
    Extracts text from a .docx file and returns it as a Markdown string.

    Conversion pipeline:
        bytes  →  BytesIO  →  MarkItDown.convert()  →  .text_content (Markdown str)

    Falls back to an empty string with a warning if MarkItDown is not
    installed or the document cannot be parsed.
    """

    async def extract_async(self, file_content: bytes) -> str:
        if not file_content:
            return ""

        try:
            from markitdown import MarkItDown  # type: ignore[import]
        except ImportError:
            logger.warning(
                "markitdown is not installed. "
                "Run `pip install markitdown[all]` to enable DOCX extraction."
            )
            return ""

        try:
            md_converter = MarkItDown()
            stream = io.BytesIO(file_content)
            result = md_converter.convert(stream, file_extension=".docx")
            extracted: str = result.text_content or ""

            markdown_output = extracted.strip()
            logger.debug(
                "DOCX extraction completed. "
                "Input bytes: %d | Output chars: %d",
                len(file_content),
                len(markdown_output),
            )
            return markdown_output

        except Exception as exc:
            logger.warning("DOCX extraction failed: %s", exc)
            return ""
