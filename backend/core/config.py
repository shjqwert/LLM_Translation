"""配置管理 - 从.env文件安全加载API Key"""
import os
from pathlib import Path
from dotenv import load_dotenv

# 加载.env文件
_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(_env_path)


def get(key: str, default: str = "") -> str:
    return os.getenv(key, default)


# 当前翻译后端
PROVIDER = get("TRANSLATE_PROVIDER", "ollama")

# Ollama
OLLAMA_BASE_URL = get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = get("OLLAMA_MODEL", "qwen2.5:7b")

# OpenAI兼容
OPENAI_API_KEY = get("OPENAI_API_KEY")
OPENAI_BASE_URL = get("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_MODEL = get("OPENAI_MODEL", "gpt-4o-mini")

# Gemini
GEMINI_API_KEY = get("GEMINI_API_KEY")
GEMINI_MODEL = get("GEMINI_MODEL", "gemini-2.0-flash")


def get_provider_status() -> dict:
    """返回各provider的配置状态（不暴露key值）"""
    return {
        "current_provider": PROVIDER,
        "providers": {
            "ollama": {
                "configured": True,
                "base_url": OLLAMA_BASE_URL,
                "model": OLLAMA_MODEL,
            },
            "openai": {
                "configured": bool(OPENAI_API_KEY),
                "base_url": OPENAI_BASE_URL,
                "model": OPENAI_MODEL,
                "key_set": bool(OPENAI_API_KEY),  # 仅告知是否已设置，不暴露key
            },
            "gemini": {
                "configured": bool(GEMINI_API_KEY),
                "model": GEMINI_MODEL,
                "key_set": bool(GEMINI_API_KEY),
            },
        },
    }
