import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_mongo_db() -> AsyncIOMotorDatabase:
    global _client, _db
    if _db is None:
        uri = os.getenv("MONGO_CONNECTION_STRING", "")
        db_name = os.getenv("MONGO_DATABASE_NAME", "pre-sales-crm")
        _client = AsyncIOMotorClient(
            uri,
            connectTimeoutMS=5000,
            serverSelectionTimeoutMS=5000,
        )
        _db = _client[db_name]
    return _db


async def ping() -> bool:
    try:
        db = get_mongo_db()
        await db.command("ping")
        return True
    except Exception:
        return False
