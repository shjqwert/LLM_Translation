"""FastAPI 应用入口"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import translate, document
from .core import cache, ollama_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动/关闭生命周期"""
    # 启动：初始化缓存、检查Ollama
    await cache.init_db()
    healthy = await ollama_client.check_health()
    if healthy:
        print("✅ Ollama service is available")
    else:
        print("⚠️  Ollama service is not available at http://localhost:11434")
        print("   Please start Ollama first: ollama serve")
    yield
    # 关闭时无需清理


app = FastAPI(
    title="LLM Translation Service",
    description="本地LLM翻译服务 - 基于Ollama + Qwen2.5",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - 允许浏览器扩展和本地前端访问
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

# 挂载静态文件 (Web UI)
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
