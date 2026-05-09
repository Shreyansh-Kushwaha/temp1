"""
TTS provider abstraction — produces audio summaries from a report's `audio_script`.

Providers (selected via TTS_PROVIDER env var, default 'gtts'):
  - gtts:          Google Translate TTS (free, no API key). Produces MP3 server-side.
                   Robotic, no voice control beyond regional accent (GTTS_TLD).
  - elevenlabs:    ElevenLabs TTS (set ELEVENLABS_API_KEY). Natural, calm male voice
                   by default. Optional ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL_ID.
  - huggingface:   HF Inference API TTS (set HF_API_TOKEN + HF_TTS_MODEL). MP3/WAV.
  - browser:       returns the script for client-side Web Speech API. Fallback only —
                   often fails in Codespaces / Linux Chrome (no installed voices).

Add a new provider by implementing `TTSProvider.synthesize`.
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from services.storage_service import upload_audio_to_cloud

logger = logging.getLogger(__name__)

ProviderName = Literal["browser", "huggingface", "gtts", "elevenlabs"]

AUDIO_DIR = Path(__file__).parent.parent / "static" / "audio"
AUDIO_URL_PREFIX = "/static/audio"


@dataclass
class TTSResult:
    provider: ProviderName
    script: str
    audio_url: str | None  # None for browser provider — client speaks the script
    duration_seconds: float | None
    voice: str | None


class TTSProvider(ABC):
    name: ProviderName

    @abstractmethod
    async def synthesize(self, script: str, *, voice: str | None = None) -> TTSResult:
        ...


# ── Browser provider (default — zero infra) ──────────────────────────────────

class BrowserTTSProvider(TTSProvider):
    name: ProviderName = "browser"

    async def synthesize(self, script: str, *, voice: str | None = None) -> TTSResult:
        # Estimate ~155 wpm reading rate, ~0.39s per word
        words = max(1, len(script.split()))
        duration = round(words / 2.6, 1)
        return TTSResult(
            provider="browser",
            script=script,
            audio_url=None,
            duration_seconds=duration,
            voice=voice,
        )


# ── HuggingFace provider ─────────────────────────────────────────────────────

class HuggingFaceTTSProvider(TTSProvider):
    name: ProviderName = "huggingface"

    def __init__(self, token: str, model: str):
        self.token = token
        self.model = model

    async def synthesize(self, script: str, *, voice: str | None = None) -> TTSResult:
        import httpx

        url = f"https://api-inference.huggingface.co/models/{self.model}"

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {self.token}"},
                json={"inputs": script},
            )
            resp.raise_for_status()
            audio_bytes = resp.content

        ext = "mp3" if resp.headers.get("content-type", "").endswith("mpeg") else "wav"
        public_audio_url = await asyncio.to_thread(upload_audio_to_cloud, audio_bytes, ext)

        # Best-effort duration estimate; precise read would need a decoder
        words = max(1, len(script.split()))
        duration = round(words / 2.6, 1)

        return TTSResult(
            provider="huggingface",
            script=script,
            audio_url=public_audio_url,
            duration_seconds=duration,
            voice=voice or self.model,
        )


# ── ElevenLabs provider (calm, natural male voice by default) ────────────────

# Default voice: "Daniel" — deep, calm, news-anchor style male voice from the
# ElevenLabs public library. Override with ELEVENLABS_VOICE_ID.
ELEVENLABS_DEFAULT_VOICE_ID = "onwK4e9ZLuTAKqWW03F9"


class ElevenLabsTTSProvider(TTSProvider):
    name: ProviderName = "elevenlabs"

    def __init__(self, api_key: str, voice_id: str, model_id: str):
        self.api_key = api_key
        self.voice_id = voice_id
        self.model_id = model_id

    async def synthesize(self, script: str, *, voice: str | None = None) -> TTSResult:
        import httpx

        # The body's `voice` arg can override the env-default voice_id
        voice_id = voice or self.voice_id
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

        # Calm narration tuning: high stability = consistent delivery, low style =
        # restrained emotion, similarity_boost = stays true to the chosen voice.
        payload = {
            "text": script,
            "model_id": self.model_id,
            "voice_settings": {
                "stability": 0.65,
                "similarity_boost": 0.75,
                "style": 0.15,
                "use_speaker_boost": True,
            },
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                url,
                headers={
                    "xi-api-key": self.api_key,
                    "accept": "audio/mpeg",
                    "content-type": "application/json",
                },
                json=payload,
            )
            if resp.status_code == 402:
                raise RuntimeError(
                    f"ElevenLabs voice '{voice_id}' is gated to a paid plan, or your "
                    "account is out of quota. Pick a pre-made free-tier voice."
                )
            if resp.status_code == 401:
                raise RuntimeError("ElevenLabs API key is invalid or revoked.")
            resp.raise_for_status()
            audio_bytes = resp.content

        public_audio_url = await asyncio.to_thread(upload_audio_to_cloud, audio_bytes, "mp3")

        words = max(1, len(script.split()))
        duration = round(words / 2.6, 1)

        return TTSResult(
            provider="elevenlabs",
            script=script,
            audio_url=public_audio_url,
            duration_seconds=duration,
            voice=f"elevenlabs:{voice_id}",
        )


# ── gTTS provider (free, no API key) ─────────────────────────────────────────

class GTTSProvider(TTSProvider):
    name: ProviderName = "gtts"

    def __init__(self, lang: str = "en", tld: str = "com"):
        self.lang = lang
        self.tld = tld  # 'co.in' = Indian English, 'co.uk' = UK English, 'com' = US English

    async def synthesize(self, script: str, *, voice: str | None = None) -> TTSResult:
        # gtts is sync + does network IO → run in a thread so we don't block the loop
        from gtts import gTTS

        tld = (voice or self.tld) if (voice and "." in (voice or "")) else self.tld

        def _generate_and_upload() -> str:
            tts = gTTS(text=script, lang=self.lang, tld=tld, slow=False)
            
            import io
            fp = io.BytesIO()
            tts.write_to_fp(fp)
            return upload_audio_to_cloud(fp.getvalue(), "mp3")

        public_audio_url = await asyncio.to_thread(_generate_and_upload)

        words = max(1, len(script.split()))
        duration = round(words / 2.6, 1)

        return TTSResult(
            provider="gtts",
            script=script,
            audio_url=public_audio_url,
            duration_seconds=duration,
            voice=f"google-{self.lang}-{tld}",
        )


# ── Factory ──────────────────────────────────────────────────────────────────

def get_provider() -> TTSProvider:
    name = (os.getenv("TTS_PROVIDER") or "gtts").strip().lower()
    if name == "elevenlabs":
        api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
        voice_id = (os.getenv("ELEVENLABS_VOICE_ID") or ELEVENLABS_DEFAULT_VOICE_ID).strip()
        model_id = (os.getenv("ELEVENLABS_MODEL_ID") or "eleven_multilingual_v2").strip()
        if api_key:
            return ElevenLabsTTSProvider(api_key=api_key, voice_id=voice_id, model_id=model_id)
        logger.warning("TTS_PROVIDER=elevenlabs but ELEVENLABS_API_KEY missing — falling back to gtts")
        name = "gtts"
    if name == "huggingface":
        token = os.getenv("HF_API_TOKEN", "").strip()
        model = os.getenv("HF_TTS_MODEL", "espnet/kan-bayashi_ljspeech_vits").strip()
        if token:
            return HuggingFaceTTSProvider(token=token, model=model)
        logger.warning("TTS_PROVIDER=huggingface but HF_API_TOKEN missing — falling back to gtts")
        name = "gtts"
    if name == "browser":
        return BrowserTTSProvider()
    if name == "gtts":
        try:
            import gtts  # noqa: F401
            lang = (os.getenv("GTTS_LANG") or "en").strip()
            tld = (os.getenv("GTTS_TLD") or "com").strip()
            return GTTSProvider(lang=lang, tld=tld)
        except ImportError:
            logger.warning("TTS_PROVIDER=gtts but `gtts` not installed — falling back to browser")
    return BrowserTTSProvider()


async def synthesize_summary(script: str, *, voice: str | None = None) -> TTSResult:
    return await get_provider().synthesize(script, voice=voice)
