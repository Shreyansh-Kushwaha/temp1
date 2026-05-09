"""
Supabase Storage adapter — uploads bytes to a configured bucket and returns the public URL.

Buckets used:
  - audio    : TTS-generated MP3/WAV summaries (see tts_service.py)
  - reports  : Playwright-rendered report PDFs (see pdf_service.py)

Both buckets must exist and be public-read for `get_public_url` to return a URL the
frontend / parent emails can fetch directly.
"""

from __future__ import annotations

import logging
import os
import uuid
from threading import Lock

from supabase import Client, create_client

logger = logging.getLogger("ptm.storage")

AUDIO_BUCKET = "audio"
REPORTS_BUCKET = "reports"

_client: Client | None = None
_client_lock = Lock()


def _get_client() -> Client:
    """Lazy module-level Supabase client. Creating one per upload would re-do the
    auth handshake every call."""
    global _client
    if _client is not None:
        return _client
    with _client_lock:
        if _client is not None:
            return _client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in the environment.")
        _client = create_client(url, key)
        return _client


def upload_to_bucket(
    bucket: str,
    data: bytes,
    file_name: str,
    content_type: str,
) -> str:
    """Upload `data` to `bucket/file_name` and return the public URL.

    Caller owns the file_name (including any subpath like `reports/{id}/v3.pdf`).
    Raises on upload failure — no silent fallback.
    """
    supabase = _get_client()
    storage = supabase.storage.from_(bucket)
    # Upsert so re-rendering a PDF for the same version overwrites the prior
    # upload (Supabase otherwise rejects with 409 Duplicate). Audio uploads
    # use random uuid filenames so duplicates are essentially impossible.
    storage.upload(
        file_name,
        data,
        file_options={"content-type": content_type, "upsert": "true"},
    )
    return storage.get_public_url(file_name)


def upload_audio_to_cloud(audio_bytes: bytes, extension: str = "mp3") -> str:
    """Audio summaries → audio bucket. Random filename, public URL returned."""
    file_name = f"{uuid.uuid4().hex}.{extension}"
    return upload_to_bucket(
        AUDIO_BUCKET,
        audio_bytes,
        file_name,
        f"audio/{extension}",
    )


def upload_report_pdf(pdf_bytes: bytes, report_id: str, version_number: int) -> str:
    """Report PDFs → reports bucket. Path is `{report_id}/v{n}.pdf` so versions
    don't overwrite each other."""
    file_name = f"{report_id}/v{version_number}.pdf"
    return upload_to_bucket(
        REPORTS_BUCKET,
        pdf_bytes,
        file_name,
        "application/pdf",
    )
