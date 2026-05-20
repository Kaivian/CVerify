"""
PDF → Markdown extractor powered by Microsoft MarkItDown.

Why Markdown output instead of plain text?
  • Headings, bullet lists, and table structure are preserved with compact
    Markdown syntax → fewer tokens than equivalent raw text.
  • Claude parses Markdown sections accurately, so downstream prompts
    can reference "the Skills section" or "the Experience section" directly.
"""

import io
import logging

from app.pipelines.shared.extractors.text_extractor import ITextExtractor

logger = logging.getLogger(__name__)


class PdfTextExtractor(ITextExtractor):
    """
    Extracts text from a PDF file and returns it as a Markdown string.

    Conversion pipeline:
        bytes  →  BytesIO  →  MarkItDown.convert()  →  .text_content (Markdown str)

    Falls back to an empty string with a warning if MarkItDown or its PDF
    backend (pdfminer.six) is not installed, or if the file is corrupted.
    """

    async def extract_async(self, file_content: bytes) -> str:
        if not file_content:
            return ""

        if not file_content.startswith(b"%PDF-"):
            logger.warning("PDF extraction failed: Invalid PDF signature")
            return ""

        try:
            from markitdown import MarkItDown  # type: ignore[import]
        except ImportError:
            logger.warning(
                "markitdown is not installed. "
                "Run `pip install markitdown[all]` to enable PDF extraction."
            )
            return ""

        try:
            md_converter = MarkItDown()
            stream = io.BytesIO(file_content)
            result = md_converter.convert(stream, file_extension=".pdf")
            extracted: str = result.text_content or ""

            # Trim excessive blank lines produced by page-break markers
            lines = extracted.splitlines()
            cleaned_lines = []
            blank_run = 0
            for line in lines:
                if line.strip() == "":
                    blank_run += 1
                    if blank_run <= 2:          # allow at most 2 consecutive blanks
                        cleaned_lines.append(line)
                else:
                    blank_run = 0
                    cleaned_lines.append(line)

            markdown_output = "\n".join(cleaned_lines).strip()
            logger.debug(
                "PDF extraction completed. "
                "Input bytes: %d | Output chars: %d",
                len(file_content),
                len(markdown_output),
            )
            return markdown_output

        except Exception as exc:
            logger.warning("PDF extraction failed: %s", exc)
            return ""
