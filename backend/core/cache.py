"""SQLite 翻译缓存层"""
import hashlib
import aiosqlite
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "translation_cache.db"

_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS translations (
    hash       TEXT PRIMARY KEY,
    source     TEXT NOT NULL,
    target     TEXT NOT NULL,
    direction  TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


def _hash_key(text: str, direction: str) -> str:
    raw = f"{direction}:{text}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


async def init_db():
    """初始化缓存数据库"""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(_CREATE_TABLE_SQL)
        await db.commit()


async def get_cached(text: str, direction: str) -> str | None:
    """查询缓存，命中返回译文，未命中返回None"""
    key = _hash_key(text, direction)
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT target FROM translations WHERE hash = ?", (key,)
        )
        row = await cursor.fetchone()
        return row[0] if row else None


async def set_cached(text: str, direction: str, translation: str):
    """写入缓存"""
    key = _hash_key(text, direction)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO translations (hash, source, target, direction) VALUES (?, ?, ?, ?)",
            (key, text, translation, direction),
        )
        await db.commit()


async def get_cache_stats() -> dict:
    """获取缓存统计信息"""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT COUNT(*) FROM translations")
        row = await cursor.fetchone()
        return {"total_entries": row[0] if row else 0}
