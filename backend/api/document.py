"""文档上传与翻译API"""
import json
import uuid
from io import BytesIO
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..core import cache, translator, document_parser

router = APIRouter(prefix="/api/document", tags=["document"])

# 内存存储已上传文档的解析结果（生产环境应改为持久化）
_uploaded_docs: dict[str, dict] = {}


class DocumentTranslateRequest(BaseModel):
    task_id: str
    direction: str = "auto"


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """上传文档，返回解析后的段落"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    try:
        content = await file.read()
        file_obj = BytesIO(content)
        segments = document_parser.parse_file(file_obj, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse file: {e}")

    task_id = str(uuid.uuid4())[:8]
    _uploaded_docs[task_id] = {
        "filename": file.filename,
        "segments": segments,
        "translations": {},
    }

    return {
        "task_id": task_id,
        "filename": file.filename,
        "total_segments": len(segments),
        "segments": segments,
    }


@router.post("/translate")
async def translate_document(req: DocumentTranslateRequest):
    """逐段流式翻译已上传的文档"""
    doc = _uploaded_docs.get(req.task_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found, please upload first")

    segments = doc["segments"]

    async def event_stream():
        for i, seg in enumerate(segments):
            text = seg["text"]
            src, tgt = translator.resolve_direction(text, req.direction)
            direction = f"{src}2{tgt}"

            # 查缓存
            cached_result = await cache.get_cached(text, direction)
            if cached_result:
                translation = cached_result
            else:
                translation = await translator.translate(text, req.direction)
                await cache.set_cached(text, direction, translation)

            doc["translations"][i] = translation
            yield f"data: {json.dumps({'index': i, 'page': seg['page'], 'source': text, 'translation': translation, 'progress': (i + 1) / len(segments)}, ensure_ascii=False)}\n\n"

        yield f"data: {json.dumps({'done': True, 'total': len(segments)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/result/{task_id}")
async def get_result(task_id: str):
    """获取文档翻译结果"""
    doc = _uploaded_docs.get(task_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    results = []
    for i, seg in enumerate(doc["segments"]):
        results.append({
            "page": seg["page"],
            "source": seg["text"],
            "translation": doc["translations"].get(i, ""),
        })

    return {
        "task_id": task_id,
        "filename": doc["filename"],
        "results": results,
    }
