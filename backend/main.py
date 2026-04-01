"""FastAPI 应用入口"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import translate, document
from .core import cache, config, ollama_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动/关闭生命周期"""
    await cache.init_db()

    provider = config.PROVIDER
    print(f"[CONFIG] Current provider: {provider}")

    if provider == "ollama":
        healthy = await ollama_client.check_health()
        if healthy:
            print(f"[OK] Ollama service is available (model: {config.OLLAMA_MODEL})")
        else:
            print(f"[WARN] Ollama service is not available at {config.OLLAMA_BASE_URL}")
    elif provider == "openai":
        if config.OPENAI_API_KEY:
            print(f"[OK] OpenAI API configured (model: {config.OPENAI_MODEL}, base: {config.OPENAI_BASE_URL})")
        else:
            print("[WARN] OpenAI API Key not set! Edit backend/.env")
    elif provider == "gemini":
        if config.GEMINI_API_KEY:
            print(f"[OK] Gemini API configured (model: {config.GEMINI_MODEL})")
        else:
            print("[WARN] Gemini API Key not set! Edit backend/.env")

    yield


app = FastAPI(
    title="LLM Translation Service",
    description="本地LLM翻译服务 - 支持Ollama/OpenAI/Gemini",
    version="1.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(translate.router)
app.include_router(document.router)


# Provider状态接口（安全：不暴露key值）
@app.get("/api/status")
async def get_status():
    return config.get_provider_status()


# 挂载静态文件 (Web UI)
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
