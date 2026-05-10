"""
Hands approved-report email delivery off to an n8n webhook.

Why a webhook (and not direct SMTP from this backend):
- Render — and most other PaaS hosts — block outbound SMTP on port 587 to
  prevent abuse, so aiosmtplib calls hang and time out. n8n is hosted on a
  network where SMTP/Gmail-API egress is allowed, so we let it do the actual
  send and report success/failure back via HTTP status.

Required env vars:
  N8N_EMAIL_WEBHOOK_URL   — full URL of the n8n Webhook node (e.g.
                            https://n8n.supersheldon.com/webhook/ptm).
                            If unset, sends are skipped (returns "skipped").

Optional env vars:
  N8N_WEBHOOK_SECRET      — sent as the X-Webhook-Secret header so the
                            workflow can reject calls that aren't from this
                            backend.

Payload posted to the webhook:
  {
    "log_id":             "<ptm_delivery_log row id, for callbacks>",
    "report_id":          "<ptm_reports id>",
    "to_email":           "<final recipient>",
    "intended_recipient": "<on-record parent email>",   // for audit
    "student_name":       "<student first+last>",
    "pretty_month":       "<e.g. May 2026>",
    "subject":            "<rendered email subject>",
    "pdf_url":            "<public Supabase URL of the rendered PDF>",
    "pdf_filename":       "<friendly download name>",
    "teacher_note":       "<optional teacher-personal-note, may be empty>",
    "from_email":         "<configured From address>",
    "from_name":          "<configured From display name>",
    "html_body":          "<pre-rendered HTML email body>",
    "text_body":          "<plaintext fallback>"
  }
"""

from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger("ptm.email")


def _from_identity() -> tuple[str, str]:
    from_email = os.getenv("SMTP_FROM_EMAIL", "support@supersheldon.com").strip()
    from_name = (os.getenv("SMTP_FROM_NAME", "Super Sheldon").strip()
                 or "Super Sheldon")
    return from_email, from_name


def _render_bodies(student_name: str, pretty_month: str, teacher_note: str) -> tuple[str, str]:
    """Pre-render the email bodies on the backend so the n8n workflow stays
    simple — its Gmail node just plugs `html_body` / `text_body` straight in
    without needing template logic."""
    note_block = ""
    if teacher_note:
        note_block = (
            f"\n\nA note from the teacher:\n{teacher_note}\n"
        )
    text_body = (
        f"Hi,\n\n"
        f"{student_name}'s monthly Parent-Teacher Meeting report for "
        f"{pretty_month} is attached as a PDF."
        f"{note_block}\n\n"
        f"Please reach out to us if you have any questions about the report "
        f"or your child's progress.\n\n"
        f"Warmly,\n"
        f"The Super Sheldon Team\n"
    )

    html_note = ""
    if teacher_note:
        # Escape just enough so a one-paragraph note can't break the layout.
        safe = (
            teacher_note.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        )
        html_note = (
            f'<p style="margin:0 0 16px;font-size:15px;line-height:1.55;'
            f'background:#FFF8F2;border-left:3px solid #FF6B1F;padding:12px 14px;'
            f'border-radius:8px;color:#3A2E25;">'
            f'<strong>A note from the teacher:</strong><br/>{safe}'
            f'</p>'
        )
    html_body = f"""<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#FFF8F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A1A;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8F2;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;box-shadow:0 4px 16px rgba(255,107,31,0.08);overflow:hidden;">
          <tr>
            <td style="background:#FF6B1F;padding:24px 32px;color:#FFFFFF;">
              <div style="font-size:14px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;">Super Sheldon</div>
              <div style="font-size:20px;font-weight:600;margin-top:4px;">Parent-Teacher Meeting Report</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">Hi,</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">
                <strong>{student_name}'s</strong> monthly Parent-Teacher Meeting report for
                <strong>{pretty_month}</strong> is attached to this email as a PDF.
              </p>
              {html_note}
              <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">
                The report covers attendance, conceptual progress, and the teacher's notes
                from this month's sessions. Please reach out to us if you have any
                questions about the report or your child's progress.
              </p>
              <p style="margin:24px 0 0;font-size:16px;line-height:1.55;">
                Warmly,<br/>
                <span style="color:#FF6B1F;font-weight:600;">The Super Sheldon Team</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#FFF8F2;color:#7A6A5C;font-size:12px;text-align:center;">
              This is an automated delivery from Super Sheldon. Please reply to this
              email to reach your teaching team.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
"""
    return text_body, html_body


async def send_report_email(
    to_email: str,
    student_name: str,
    pretty_month: str,
    pdf_url: str,
    pdf_filename: str,
    *,
    intended_recipient: str | None = None,
    teacher_note: str | None = None,
    log_id: str | None = None,
    report_id: str | None = None,
) -> tuple[str, str | None]:
    """Hand the send off to the configured n8n webhook.

    Returns:
      ("sent",    None)              webhook accepted (HTTP 2xx)
      ("skipped", reason)            webhook URL not configured / no recipient
      ("failed",  error)             webhook returned non-2xx, or network error
    Never raises.
    """
    webhook_url = os.getenv("N8N_EMAIL_WEBHOOK_URL", "").strip()
    if not webhook_url:
        logger.info("Email skipped: N8N_EMAIL_WEBHOOK_URL not configured")
        return ("skipped", "n8n_webhook_not_configured")
    if not to_email:
        return ("skipped", "no_recipient")
    if not pdf_url:
        return ("skipped", "no_pdf_url")

    from_email, from_name = _from_identity()
    text_body, html_body = _render_bodies(
        student_name, pretty_month, (teacher_note or "").strip()
    )

    payload = {
        "log_id": log_id,
        "report_id": report_id,
        "to_email": to_email,
        "intended_recipient": intended_recipient,
        "student_name": student_name,
        "pretty_month": pretty_month,
        "subject": f"{student_name}'s {pretty_month} PTM Report",
        "pdf_url": pdf_url,
        "pdf_filename": pdf_filename,
        "teacher_note": (teacher_note or "").strip(),
        "from_email": from_email,
        "from_name": from_name,
        "html_body": html_body,
        "text_body": text_body,
    }

    headers = {"content-type": "application/json"}
    secret = os.getenv("N8N_WEBHOOK_SECRET", "").strip()
    if secret:
        headers["X-Webhook-Secret"] = secret

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(webhook_url, json=payload, headers=headers)
    except Exception as e:
        logger.exception("n8n webhook call failed: to=%s", to_email)
        return ("failed", f"webhook_error: {type(e).__name__}: {str(e)[:200]}")

    if 200 <= resp.status_code < 300:
        logger.info(
            "Email handed off to n8n: to=%s student=%s month=%s status=%s",
            to_email, student_name, pretty_month, resp.status_code,
        )
        return ("sent", None)

    body_excerpt = resp.text[:200] if resp.text else ""
    logger.error(
        "n8n webhook returned %s for to=%s: %s",
        resp.status_code, to_email, body_excerpt,
    )
    return ("failed", f"webhook_status_{resp.status_code}: {body_excerpt}"[:300])
