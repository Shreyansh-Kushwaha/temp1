"""
Async Postgres connection management for the PTM backend.

Backed by a single asyncpg pool against Supabase's Transaction Pooler
(port 6543). Pool is initialized once at app startup via init_pool() and
reused for every request — see main.py lifespan.

A compatibility shim (_AsyncpgCompatConn / _Cursor) preserves the
aiosqlite-style API (db.execute, fetchone/fetchall, db.commit, db.close)
so existing routers and services don't need to be rewritten — they use
'?' placeholders and the wrapper translates them to '$1, $2, …' for
asyncpg under the hood.

Migrations live in ./migrations/*.sql and are applied in lexical order
on first boot. Already-applied filenames are tracked in _schema_migrations.
"""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Any, Sequence

import asyncpg

logger = logging.getLogger("ptm.db")

MIGRATIONS_DIR = Path(__file__).parent / "migrations"

_pool: asyncpg.Pool | None = None


# ────────────────────────────────────────────────────────────────────────
# Pool lifecycle
# ────────────────────────────────────────────────────────────────────────

async def init_pool() -> asyncpg.Pool:
    """Create the connection pool. Idempotent.

    Reads the DSN from any of (in priority order): SUPABASE_DB_URL,
    SUPABASE_STRING, DATABASE_URL. If the password contains URL-reserved
    characters (#, @, /, ?, etc.) we re-parse and rebuild the URL with
    the password percent-encoded so asyncpg's parser doesn't truncate.
    """
    global _pool
    if _pool is not None:
        return _pool
    dsn = (
        os.getenv("SUPABASE_DB_URL")
        or os.getenv("SUPABASE_STRING")
        or os.getenv("DATABASE_URL")
    )
    if not dsn:
        raise RuntimeError(
            "No DB DSN set. Provide SUPABASE_DB_URL (or SUPABASE_STRING / "
            "DATABASE_URL). Get the Transaction Pooler connection string "
            "from Supabase Dashboard → Project Settings → Database."
        )
    dsn = _normalize_dsn(dsn)

    # statement_cache_size=0 is REQUIRED when going through Supabase's
    # Transaction Pooler (pgBouncer). It's also harmless for the direct
    # connection (port 5432) — just disables prepared-statement caching.
    _pool = await asyncpg.create_pool(
        dsn,
        min_size=1,
        max_size=10,
        statement_cache_size=0,
        command_timeout=60,
    )
    logger.info("asyncpg pool initialized")
    return _pool


def _normalize_dsn(dsn: str) -> str:
    """If the password contains URL-reserved characters (#, @, /, ?, etc.),
    re-encode them so asyncpg's parser sees the full password.

    A DSN like postgresql://user:Sg#7620@host:5432/db would otherwise have
    '#7620@host:5432/db' eaten as a URL fragment. We do a manual scan
    before urlsplit to catch this.
    """
    from urllib.parse import quote

    if "://" not in dsn:
        return dsn
    scheme, rest = dsn.split("://", 1)
    # Split at the LAST '@' — anything before is auth, after is host/path.
    if "@" not in rest:
        return dsn
    auth, hostpath = rest.rsplit("@", 1)
    if ":" not in auth:
        return dsn
    user, pw = auth.split(":", 1)
    # Re-encode each part safely (quote leaves alphanumerics + a few chars alone).
    user_q = quote(user, safe="")
    pw_q = quote(pw, safe="")
    return f"{scheme}://{user_q}:{pw_q}@{hostpath}"


async def get_pool() -> asyncpg.Pool:
    if _pool is None:
        await init_pool()
    assert _pool is not None
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("asyncpg pool closed")


# ────────────────────────────────────────────────────────────────────────
# aiosqlite-style API → asyncpg compat shim
# ────────────────────────────────────────────────────────────────────────

_PARAM_RE = re.compile(r"\?")


def _translate_placeholders(sql: str) -> str:
    """Convert '?' placeholders to '$1, $2, …'.

    Our migration/runtime SQL strings don't embed '?' inside string
    literals so a flat regex is safe. If that ever changes we can add a
    tokenizer that skips quoted regions.
    """
    counter = {"n": 0}

    def repl(_m: re.Match[str]) -> str:
        counter["n"] += 1
        return f"${counter['n']}"

    return _PARAM_RE.sub(repl, sql)


class _Cursor:
    """Async-context-manager cursor that mimics aiosqlite's pattern:

        async with db.execute(query, params) as cur:
            row = await cur.fetchone()

    Internally runs `conn.fetch()` for SELECT-shaped queries and
    `conn.execute()` for everything else. Result rows are asyncpg.Record
    instances which already support `row["col"]` and `dict(row)`.
    """

    def __init__(self, conn: asyncpg.Connection, sql: str, params: Sequence[Any]):
        self._conn = conn
        self._sql_pg = _translate_placeholders(sql)
        self._params = list(params)
        self._rows: list[asyncpg.Record] = []
        self._ran = False

    async def _run(self) -> None:
        if self._ran:
            return
        head = self._sql_pg.lstrip().upper()
        if head.startswith(("SELECT", "WITH", "VALUES")) or "RETURNING" in head:
            self._rows = await self._conn.fetch(self._sql_pg, *self._params)
        else:
            await self._conn.execute(self._sql_pg, *self._params)
            self._rows = []
        self._ran = True

    # asyncpg can be awaited directly (`await db.execute(...)`) — when the
    # caller doesn't enter the context manager, e.g. for INSERT/UPDATE.
    def __await__(self):
        return self._run().__await__()

    async def __aenter__(self) -> "_Cursor":
        await self._run()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False

    async def fetchone(self) -> asyncpg.Record | None:
        await self._run()
        return self._rows[0] if self._rows else None

    async def fetchall(self) -> list[asyncpg.Record]:
        await self._run()
        return self._rows


class _AsyncpgCompatConn:
    """Wraps an asyncpg.Connection acquired from the pool, exposing the
    aiosqlite-style API the rest of the codebase already uses."""

    def __init__(self, pool: asyncpg.Pool, conn: asyncpg.Connection):
        self._pool = pool
        self._conn = conn
        self._closed = False

    # row_factory is a no-op — asyncpg.Record already supports dict access.
    @property
    def row_factory(self):
        return None

    @row_factory.setter
    def row_factory(self, _val):
        pass

    def execute(self, sql: str, params: Sequence[Any] | None = None) -> _Cursor:
        return _Cursor(self._conn, sql, params or [])

    async def executescript(self, sql: str) -> None:
        # asyncpg.execute() runs multi-statement scripts when no $-params
        # are involved. Migration files contain only DDL with no params.
        await self._conn.execute(sql)

    async def commit(self) -> None:
        # asyncpg auto-commits per-statement outside transactions. Explicit
        # commit() calls in old aiosqlite code become no-ops.
        return None

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        await self._pool.release(self._conn)


# ────────────────────────────────────────────────────────────────────────
# Public API used by routers/services
# ────────────────────────────────────────────────────────────────────────

async def get_db() -> _AsyncpgCompatConn:
    """Acquire a pool connection wrapped in the aiosqlite compat shim.

    Existing routers use:
        db = await get_db()
        try:
            ... await db.execute(...) ... await db.commit()
        finally:
            await db.close()

    `db.close()` releases the connection back to the pool — it does NOT
    close the pool itself.
    """
    pool = await get_pool()
    conn = await pool.acquire()
    return _AsyncpgCompatConn(pool, conn)


# ────────────────────────────────────────────────────────────────────────
# Migration runner
# ────────────────────────────────────────────────────────────────────────

async def run_migrations() -> None:
    """Apply each .sql migration exactly once. Each file runs in its own
    transaction so partial failures roll back cleanly."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS _schema_migrations (
              filename   TEXT PRIMARY KEY,
              applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        applied = {
            r["filename"]
            for r in await conn.fetch("SELECT filename FROM _schema_migrations")
        }

        for sql_file in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if sql_file.name in applied:
                continue
            sql = sql_file.read_text()
            logger.info("applying migration %s", sql_file.name)
            async with conn.transaction():
                await conn.execute(sql)
                await conn.execute(
                    "INSERT INTO _schema_migrations (filename) VALUES ($1)",
                    sql_file.name,
                )
            logger.info("migration %s applied", sql_file.name)
