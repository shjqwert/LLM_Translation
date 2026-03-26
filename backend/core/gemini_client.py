"""Google Gemini API客户端"""
import httpx
from typing import AsyncIterator
from . import config

TIMEOUT = 120.0
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"


async def generate(prompt: str, system: str = "") -> str:
    """非流式调用Gemini"""
    contents = []
    if system:
        contents.append({"role": "user", "parts": [{"text": system}]})
        contents.append({"role": "model", "parts": [{"text": "Understood."}]})
    contents.append({"role": "user", "parts": [{"text": prompt}]})

    payload = {"contents": contents}

    url = f"{GEMINI_API_BASE}/models/{config.GEMINI_MODEL}:generateContent?key={config.GEMINI_API_KEY}"

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def generate_stream(prompt: str, system: str = "") -> AsyncIterator[str]:
    """流式调用Gemini"""
    contents = []
    if system:
        contents.append({"role": "user", "parts": [{"text": system}]})
        contents.append({"role": "model", "parts": [{"text": "Understood."}]})
    contents.append({"role": "user", "parts": [{"text": prompt}]})

    payload = {"contents": contents}

    url = f"{GEMINI_API_BASE}/models/{config.GEMINI_MODEL}:streamGenerateContent?alt=sse&key={config.GEMINI_API_KEY}"

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        async with client.stream("POST", url, json=payload) as resp:
            resp.raise_for_status()
            import json as json_mod
            async for line in resp.aiter_lines():
                line = line.strip()
                if not line or not line.startswith("data: "):
                    continue
                data = json_mod.loads(line[6:])
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    for part in parts:
                        text = part.get("text", "")
                        if text:
                            yield text
