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
import uuid
from datetime import datetime, timezone

from db.connection import get_db
from services import storage_service

logger = logging.getLogger("ptm.pdf")


def _pretty_month(reporting_month: str | None) -> str:
    """'2026-04-01' → 'April 2026'. Falls back to the raw value if unparseable."""
    if not reporting_month:
        return ""
    try:
        d = datetime.strptime(str(reporting_month)[:7], "%Y-%m")
        return d.strftime("%B %Y")
    except Exception:
        return str(reporting_month)

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
            # Wait for page resources to load, NOT networkidle: the
            # BackendStatusIndicator polls /health on a continuous timer,
            # so networkidle would basically never fire and Playwright would
            # time out. The report content is already in the SSR'd markup,
            # so 'load' is sufficient.
            response = await page.goto(url, wait_until="load", timeout=PDF_TIMEOUT_MS)
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


async def generate_and_store_pdf(
    report_id: str,
    version_number: int,
    send_email: bool = False,
    recipient_email_override: str | None = None,
) -> str | None:
    """Render the report's print page, upload to Supabase, persist the URL on
    `ptm_reports.pdf_url` and `ptm_report_versions.pdf_url`. Returns the URL on
    success, None on failure (background task — must not raise).

    When `send_email=True` (set by the approve flow), also emails the rendered
    PDF to the student/parent address pulled from MongoDB. Email failures are
    logged + recorded in ptm_delivery_log; they never roll back the PDF step.
    """
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

    if send_email:
        try:
            await _email_approved_report(report_id, pdf_bytes, recipient_email_override)
        except Exception:
            logger.exception("Email step failed: report=%s", report_id)

    return public_url


async def _email_approved_report(
    report_id: str,
    pdf_bytes: bytes,
    recipient_email_override: str | None = None,
) -> None:
    """Look up the recipient + send the email + record the outcome.

    Updates the existing email-channel ptm_delivery_log row (created by
    approve_report) with the actual outcome, or inserts a new row if no
    pending row exists.
    """
    from services import email_service, wise_service

    db = await get_db()
    try:
        async with db.execute(
            "SELECT student_id, student_name, reporting_month, status "
            "FROM ptm_reports WHERE id=?",
            [report_id],
        ) as cur:
            row = await cur.fetchone()
    finally:
        await db.close()

    if not row:
        logger.warning("Email skipped: report not found id=%s", report_id)
        return
    student_id, student_name, reporting_month, status = row[0], row[1], row[2], row[3]
    if status != "approved":
        logger.info(
            "Email skipped: report not in 'approved' state (status=%s) id=%s",
            status, report_id,
        )
        return

    override_recipient = (recipient_email_override or "").strip() or None
    if override_recipient:
        to_email = override_recipient
        logger.info(
            "Email recipient overridden by teacher: report=%s recipient=%s",
            report_id, override_recipient,
        )
    else:
        to_email = await wise_service.get_student_email(student_id)
    pretty_month = _pretty_month(reporting_month)
    safe_name = (student_name or "Student").replace(" ", "_").replace("/", "_")
    safe_month = pretty_month.replace(" ", "_") or "Report"
    pdf_filename = f"PTM_Report_{safe_name}_{safe_month}.pdf"

    delivery_status, error = await email_service.send_report_email(
        to_email=to_email or "",
        student_name=student_name or "Your child",
        pretty_month=pretty_month,
        pdf_bytes=pdf_bytes,
        pdf_filename=pdf_filename,
    )

    if delivery_status == "skipped" and not to_email:
        error = "no_email_on_record"
        logger.warning(
            "Email skipped: no email on record for student_id=%s name=%s",
            student_id, student_name,
        )
        # Raise a support ticket so it shows up on /ptm/issues for the team
        # to chase. Idempotent — won't duplicate if one is already open.
        try:
            from services import issue_service
            await issue_service.upsert_issue(
                type_="email_missing",
                severity="medium",
                title=f"No email on record for {student_name}",
                description=(
                    f"Approval of report {report_id} for {student_name} "
                    "could not be delivered — the Wise classroom record has "
                    "no parent/student email. The PDF was still generated and "
                    "is available from the report page."
                ),
                entity_type="student",
                entity_id=student_id,
                entity_name=student_name,
                metadata={"report_id": report_id},
                created_by="auto_approve",
            )
        except Exception:
            logger.exception("Failed to upsert email_missing issue (non-fatal)")

    sent_at = datetime.now(timezone.utc).isoformat()
    # actual_recipient is where the SMTP send went (may be the override inbox);
    # intended_recipient is who the parent would normally be — same value when
    # no override is configured.
    override = os.getenv("EMAIL_OVERRIDE_RECIPIENT", "").strip()
    actual_recipient = override or to_email or None
    intended_recipient = to_email or None

    db = await get_db()
    try:
        async with db.execute(
            "SELECT id FROM ptm_delivery_log WHERE report_id=? AND channel='email' "
            "ORDER BY sent_at DESC LIMIT 1",
            [report_id],
        ) as cur:
            existing = await cur.fetchone()
        if existing:
            await db.execute(
                "UPDATE ptm_delivery_log SET status=?, sent_at=?, error_msg=?, "
                "recipient=?, intended_recipient=? WHERE id=?",
                [delivery_status, sent_at, error,
                 actual_recipient, intended_recipient, existing[0]],
            )
        else:
            await db.execute(
                "INSERT INTO ptm_delivery_log "
                "(id, report_id, channel, status, sent_at, error_msg, recipient, intended_recipient) "
                "VALUES (?, ?, 'email', ?, ?, ?, ?, ?)",
                [str(uuid.uuid4()), report_id, delivery_status, sent_at, error,
                 actual_recipient, intended_recipient],
            )
        await db.commit()
    finally:
        await db.close()
