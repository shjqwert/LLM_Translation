"""OpenAI兼容API客户端 (支持OpenAI/DeepSeek/通义千问等)"""
import httpx
from typing import AsyncIterator
from . import config

TIMEOUT = 120.0


async def generate(prompt: str, system: str = "") -> str:
    """非流式调用"""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    headers = {
        "Authorization": f"Bearer {config.OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": config.OPENAI_MODEL,
        "messages": messages,
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(
            f"{config.OPENAI_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


async def generate_stream(prompt: str, system: str = "") -> AsyncIterator[str]:
    """流式调用"""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    headers = {
        "Authorization": f"Bearer {config.OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": config.OPENAI_MODEL,
        "messages": messages,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        async with client.stream(
            "POST",
            f"{config.OPENAI_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
        ) as resp:
            resp.raise_for_status()
            import json as json_mod
            async for line in resp.aiter_lines():
                line = line.strip()
                if not line or line == "data: [DONE]":
                    continue
                if line.startswith("data: "):
                    data = json_mod.loads(line[6:])
                    delta = data["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
