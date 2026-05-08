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
    """Apply each .sql migration exactly once. Records applied filenames in _schema_migrations."""
    db = await get_db()
    try:
        await db.execute(
            "CREATE TABLE IF NOT EXISTS _schema_migrations (filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"
        )
        await db.commit()

        async with db.execute("SELECT filename FROM _schema_migrations") as cur:
            applied = {row[0] for row in await cur.fetchall()}

        from datetime import datetime, timezone

        for sql_file in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if sql_file.name in applied:
                continue
            sql = sql_file.read_text()
            await db.executescript(sql)
            await db.execute(
                "INSERT INTO _schema_migrations (filename, applied_at) VALUES (?, ?)",
                [sql_file.name, datetime.now(timezone.utc).isoformat()],
            )
            await db.commit()
    finally:
        await db.close()
