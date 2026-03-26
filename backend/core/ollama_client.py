"""Ollama API 客户端封装"""
import httpx
from typing import AsyncIterator
from . import config

TIMEOUT = 120.0


async def generate(
    prompt: str,
    system: str = "",
) -> str:
    """非流式调用Ollama，返回完整响应文本"""
    payload = {
        "model": config.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
    }
    if system:
        payload["system"] = system

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(f"{config.OLLAMA_BASE_URL}/api/generate", json=payload)
        resp.raise_for_status()
        return resp.json()["response"]


async def generate_stream(
    prompt: str,
    system: str = "",
) -> AsyncIterator[str]:
    """流式调用Ollama，逐块yield文本片段"""
    payload = {
        "model": config.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": True,
    }
    if system:
        payload["system"] = system

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        async with client.stream(
            "POST", f"{config.OLLAMA_BASE_URL}/api/generate", json=payload
        ) as resp:
            resp.raise_for_status()
            import json as json_mod
            async for line in resp.aiter_lines():
                if line.strip():
                    data = json_mod.loads(line)
                    if "response" in data:
                        yield data["response"]
                    if data.get("done"):
                        break


async def check_health() -> bool:
    """检查Ollama服务是否可用"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{config.OLLAMA_BASE_URL}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False
