"""翻译API路由"""
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..core import cache, translator

router = APIRouter(prefix="/api/translate", tags=["translate"])


class TranslateRequest(BaseModel):
    text: str
    direction: str = "auto"  # "en2zh" | "zh2en" | "auto"


class TranslateResponse(BaseModel):
    translation: str
    direction: str
    cached: bool = False


class BatchTranslateRequest(BaseModel):
    texts: list[str]
    direction: str = "auto"


# ---------- 单句翻译 ----------
@router.post("", response_model=TranslateResponse)
async def translate_text(req: TranslateRequest):
    src, tgt = translator.resolve_direction(req.text, req.direction)
    direction = f"{src}2{tgt}"

    # 查缓存
    cached = await cache.get_cached(req.text, direction)
    if cached:
        return TranslateResponse(translation=cached, direction=direction, cached=True)

    # 调用模型
    result = await translator.translate(req.text, req.direction)

    # 写缓存
    await cache.set_cached(req.text, direction, result)

    return TranslateResponse(translation=result, direction=direction, cached=False)


# ---------- 流式翻译 ----------
@router.post("/stream")
async def translate_stream(req: TranslateRequest):
    src, tgt = translator.resolve_direction(req.text, req.direction)
    direction = f"{src}2{tgt}"

    # 缓存命中直接返回
    cached = await cache.get_cached(req.text, direction)
    if cached:

        async def cached_stream():
            yield f"data: {json.dumps({'text': cached, 'done': True, 'cached': True}, ensure_ascii=False)}\n\n"

        return StreamingResponse(cached_stream(), media_type="text/event-stream")

    # 流式翻译
    collected = []

    async def event_stream():
        async for chunk in translator.translate_stream(req.text, req.direction):
            collected.append(chunk)
            yield f"data: {json.dumps({'text': chunk, 'done': False}, ensure_ascii=False)}\n\n"
        # 完成信号
        full_text = "".join(collected)
        await cache.set_cached(req.text, direction, full_text)
        yield f"data: {json.dumps({'text': '', 'done': True}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ---------- 批量翻译 ----------
@router.post("/batch")
async def translate_batch(req: BatchTranslateRequest):
    results = []
    for text in req.texts:
        src, tgt = translator.resolve_direction(text, req.direction)
        direction = f"{src}2{tgt}"

        cached = await cache.get_cached(text, direction)
        if cached:
            results.append(
                {"text": text, "translation": cached, "direction": direction, "cached": True}
            )
        else:
            result = await translator.translate(text, req.direction)
            await cache.set_cached(text, direction, result)
            results.append(
                {"text": text, "translation": result, "direction": direction, "cached": False}
            )
    return {"results": results}
