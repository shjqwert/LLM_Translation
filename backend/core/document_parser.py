"""文档解析器：PDF、DOCX、TXT"""
from pathlib import Path
from typing import BinaryIO


def parse_pdf(file: BinaryIO) -> list[dict]:
    """解析PDF文件，返回按页分段的文本"""
    from PyPDF2 import PdfReader

    reader = PdfReader(file)
    result = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text and text.strip():
            result.append({"page": i + 1, "text": text.strip()})
    return result


def parse_docx(file: BinaryIO) -> list[dict]:
    """解析DOCX文件，返回按段落分段的文本"""
    from docx import Document

    doc = Document(file)
    result = []
    for i, para in enumerate(doc.paragraphs):
        text = para.text.strip()
        if text:
            result.append({"page": i + 1, "text": text})
    return result


def parse_txt(file: BinaryIO, encoding: str = "utf-8") -> list[dict]:
    """解析TXT文件，返回按行分段的文本"""
    content = file.read()
    if isinstance(content, bytes):
        content = content.decode(encoding, errors="replace")
    lines = content.splitlines()
    result = []
    for i, line in enumerate(lines):
        text = line.strip()
        if text:
            result.append({"page": i + 1, "text": text})
    return result


def parse_file(file: BinaryIO, filename: str) -> list[dict]:
    """根据文件扩展名自动选择解析器"""
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return parse_pdf(file)
    elif ext in (".docx", ".doc"):
        return parse_docx(file)
    elif ext in (".txt", ".md", ".rst"):
        return parse_txt(file)
    else:
        raise ValueError(f"Unsupported file type: {ext}")
