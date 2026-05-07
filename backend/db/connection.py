import aiosqlite
import os
from pathlib import Path

DB_PATH = os.getenv("DB_PATH", str(Path(__file__).parent.parent / "ptm.db"))
MIGRATIONS_DIR = Path(__file__).parent / "migrations"


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys = ON")
    return db


async def run_migrations():
    db = await get_db()
    try:
        for sql_file in sorted(MIGRATIONS_DIR.glob("*.sql")):
            sql = sql_file.read_text()
            await db.executescript(sql)
        await db.commit()
    finally:
        await db.close()
