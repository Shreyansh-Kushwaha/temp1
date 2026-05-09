"""
Renders the report's print page to PDF via Playwright and uploads it to Supabase.

The frontend already exposes `/ptm/{id}/print` as a clean print layout — this
service drives a headless Chromium against that URL, captures the PDF, then
uploads via storage_service.

Requirements:
  - playwright (pip) + `playwright install chromium` once at deploy time.
  - FRONTEND_URL must be reachable from the backend (default http://localhost:3000).
  - Supabase `reports` bucket must exist (public read).
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone

from db.connection import get_db
from services import storage_service

logger = logging.getLogger("ptm.pdf")

PDF_TIMEOUT_MS = int(os.getenv("PTM_PDF_TIMEOUT_MS", "30000"))


async def render_report_pdf(report_id: str) -> bytes:
    # Lazy-import so the backend boots even when playwright isn't installed yet.
    from playwright.async_api import async_playwright

    frontend_url = (os.getenv("FRONTEND_URL") or "http://localhost:3000").rstrip("/")
    url = f"{frontend_url}/ptm/{report_id}/print"

    async with async_playwright() as p:
        # Set viewport to roughly A4 width so the on-screen layout (which is
        # capped at max-width: 21cm = ~794 CSS px) renders identically to what
        # the teacher sees in the editor.
        browser = await p.chromium.launch()
        try:
            # Viewport tall enough that even a long report fits without forcing
            # any flex / min-h-full layout to crop measurements.
            page = await browser.new_page(viewport={"width": 900, "height": 8000})
            # Use screen media so we render the editor view as-is, not the
            # @media print A4 page-table layout. Result: one long PDF page
            # that matches the in-app preview exactly — no pagination, no
            # broken sections, no blank space.
            await page.emulate_media(media="screen")
            response = await page.goto(url, wait_until="networkidle", timeout=PDF_TIMEOUT_MS)
            logger.info(
                "Playwright navigated to %s → status %s",
                url, response.status if response else "no response",
            )
            # Hide editor chrome (toolbar etc.) AND any margin/padding around
            # the page-wrap that would create dead space in the PDF.
            await page.add_style_tag(content="""
                .no-print { display: none !important; }
                html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
                .page-wrap { margin: 0 auto !important; box-shadow: none !important; }
            """)

            # Wait a beat for layout to stabilize after style injection, then
            # measure the .page-wrap's actual rendered size and use that as
            # the PDF page dimensions — yields one continuous page that mirrors
            # the on-screen preview exactly.
            await page.wait_for_timeout(300)
            dims = await page.evaluate("""
                () => {
                  // Auto-fit body so layout: 100vh tricks don't pin height to viewport.
                  document.documentElement.style.height = 'auto';
                  document.body.style.height = 'auto';
                  document.body.style.minHeight = '0';
                  const wrap = document.querySelector('.page-wrap');
                  if (wrap) {
                    wrap.style.height = 'auto';
                    wrap.style.minHeight = '0';
                  }
                  const el = wrap || document.body;
                  return {
                    width: Math.ceil(el.getBoundingClientRect().width || el.scrollWidth),
                    height: Math.ceil(el.scrollHeight),
                    bodyScroll: document.body.scrollHeight,
                    docScroll: document.documentElement.scrollHeight,
                  };
                }
            """)
            logger.info("Measured dims: %s", dims)
            # Use the page-wrap's measured size — it accurately bounds the
            # content. body/doc scrollHeight can pick up the inflated viewport
            # we set to make sure long content has room to lay out.
            width_px = max(int(dims["width"]), 600)
            height_px = max(int(dims["height"]), 600)
            logger.info("Rendering single-page PDF at %sx%s px", width_px, height_px)

            pdf_bytes = await page.pdf(
                width=f"{width_px}px",
                height=f"{height_px}px",
                print_background=True,
                margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
            )
            logger.info("Playwright produced PDF: %s bytes", len(pdf_bytes))
            return pdf_bytes
        finally:
            await browser.close()


async def generate_and_store_pdf(report_id: str, version_number: int) -> str | None:
    """Render the report's print page, upload to Supabase, persist the URL on
    `ptm_reports.pdf_url` and `ptm_report_versions.pdf_url`. Returns the URL on
    success, None on failure (background task — must not raise)."""
    try:
        pdf_bytes = await render_report_pdf(report_id)
        public_url = await asyncio.to_thread(
            storage_service.upload_report_pdf, pdf_bytes, report_id, version_number
        )
    except Exception:
        logger.exception(
            "PDF render/upload failed: report=%s version=%s", report_id, version_number
        )
        return None

    ts = datetime.now(timezone.utc).isoformat()
    db = await get_db()
    try:
        await db.execute(
            "UPDATE ptm_reports SET pdf_url=?, updated_at=? WHERE id=?",
            [public_url, ts, report_id],
        )
        await db.execute(
            "UPDATE ptm_report_versions SET pdf_url=? WHERE report_id=? AND version_number=?",
            [public_url, report_id, version_number],
        )
        await db.commit()
    finally:
        await db.close()

    logger.info(
        "Report PDF stored: report=%s version=%s url=%s",
        report_id, version_number, public_url,
    )
    return public_url
