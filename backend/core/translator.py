"""翻译逻辑：prompt构造、语言检测、文本分段"""
import re
from typing import AsyncIterator

from .ollama_client import generate, generate_stream

# ---------- Prompt模板 ----------
SYSTEM_PROMPT = (
    "You are a professional translator. "
    "Translate accurately and naturally. "
    "Output ONLY the translation, nothing else."
)

TRANSLATE_PROMPT_TEMPLATE = "Translate the following {src} text to {tgt}:\n\n{text}"

LANG_MAP = {
    "en": "English",
    "zh": "Chinese",
}


# ---------- 语言检测 ----------
_CJK_RANGE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")


def detect_language(text: str) -> str:
    """简单启发式语言检测：含中文字符占比>30%视为中文"""
    if not text.strip():
        return "en"
    cjk_chars = len(_CJK_RANGE.findall(text))
    ratio = cjk_chars / max(len(text), 1)
    return "zh" if ratio > 0.3 else "en"


def resolve_direction(text: str, direction: str) -> tuple[str, str]:
    """
    返回 (source_lang, target_lang)
    direction: "en2zh" | "zh2en" | "auto"
    """
    if direction == "en2zh":
        return "en", "zh"
    elif direction == "zh2en":
        return "zh", "en"
    else:  # auto
        src = detect_language(text)
        tgt = "zh" if src == "en" else "en"
        return src, tgt


# ---------- 文本分段 ----------
_SENTENCE_SPLIT = re.compile(r"(?<=[。.!?！？\n])\s*")


def split_text(text: str, max_length: int = 500) -> list[str]:
    """按句子分割文本，每段不超过max_length字符"""
    sentences = _SENTENCE_SPLIT.split(text)
    segments: list[str] = []
    current = ""

    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if len(current) + len(s) + 1 <= max_length:
            current = f"{current} {s}".strip() if current else s
        else:
            if current:
                segments.append(current)
            # 如果单个句子超长，直接加入
            current = s

    if current:
        segments.append(current)

    return segments if segments else [text]


# ---------- 翻译接口 ----------
def _build_prompt(text: str, src: str, tgt: str) -> str:
    return TRANSLATE_PROMPT_TEMPLATE.format(
        src=LANG_MAP.get(src, src),
        tgt=LANG_MAP.get(tgt, tgt),
        text=text,
    )


async def translate(text: str, direction: str = "auto") -> str:
    """非流式翻译，返回完整译文"""
    src, tgt = resolve_direction(text, direction)
    prompt = _build_prompt(text, src, tgt)
    result = await generate(prompt, system=SYSTEM_PROMPT)
    return result.strip()


async def translate_stream(text: str, direction: str = "auto") -> AsyncIterator[str]:
    """流式翻译，逐块yield译文片段"""
    src, tgt = resolve_direction(text, direction)
    prompt = _build_prompt(text, src, tgt)
    async for chunk in generate_stream(prompt, system=SYSTEM_PROMPT):
        yield chunk
