"""
Sends approved PTM reports as PDF email attachments via SMTP.

Required env vars (all must be set; otherwise send is skipped):
  SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD,
  SMTP_FROM_EMAIL, SMTP_FROM_NAME

For Gmail / Google Workspace: use an App Password (not the account password).
"""

from __future__ import annotations

import logging
import os
from email.message import EmailMessage
from email.utils import formataddr

logger = logging.getLogger("ptm.email")


def _smtp_config() -> dict | None:
    # Accept SMTP_SERVER as an alias for SMTP_HOST so either env-var name works.
    cfg = {
        "host": (os.getenv("SMTP_HOST") or os.getenv("SMTP_SERVER") or "").strip(),
        "port": int(os.getenv("SMTP_PORT", "587") or "587"),
        "username": os.getenv("SMTP_USERNAME", "").strip(),
        "password": os.getenv("SMTP_PASSWORD", "").strip(),
        "from_email": os.getenv("SMTP_FROM_EMAIL", "").strip(),
        "from_name": os.getenv("SMTP_FROM_NAME", "Super Sheldon").strip() or "Super Sheldon",
    }
    if not (cfg["host"] and cfg["username"] and cfg["password"] and cfg["from_email"]):
        return None
    return cfg


def _build_message(
    to_email: str,
    student_name: str,
    pretty_month: str,
    pdf_bytes: bytes,
    pdf_filename: str,
    cfg: dict,
    original_recipient: str = "",
) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = formataddr((cfg["from_name"], cfg["from_email"]))
    msg["To"] = to_email
    msg["Subject"] = f"{student_name}'s {pretty_month} PTM Report"
    # When the override is on, record the real intended recipient in a hidden
    # custom header so the visible email matches the parent-facing version 1:1
    # but we can still trace where it would have gone in test mode.
    if original_recipient and original_recipient != to_email:
        msg["X-PTM-Original-Recipient"] = original_recipient

    text_body = (
        f"Hi,\n\n"
        f"{student_name}'s monthly Parent-Teacher Meeting report for {pretty_month} "
        f"is attached as a PDF.\n\n"
        f"Please reach out to us if you have any questions about the report or "
        f"your child's progress.\n\n"
        f"Warmly,\n"
        f"The Super Sheldon Team\n"
    )
    msg.set_content(text_body)

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
    msg.add_alternative(html_body, subtype="html")

    msg.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=pdf_filename,
    )
    return msg


async def send_report_email(
    to_email: str,
    student_name: str,
    pretty_month: str,
    pdf_bytes: bytes,
    pdf_filename: str,
) -> tuple[str, str | None]:
    """
    Returns one of:
      ("sent",    None)
      ("skipped", reason)   — config missing or no recipient; safe to ignore
      ("failed",  error)    — SMTP attempt errored; surfaces in delivery_log
    Never raises.

    Test-mode safety: if EMAIL_OVERRIDE_RECIPIENT is set, every email is
    routed to that address — including when the student has no email on
    record (so QA still gets a deliverable for every approval). The visible
    message is identical to what the parent would receive (same subject,
    body, PDF). The real intended recipient is recorded only in a hidden
    X-PTM-Original-Recipient header and the server logs. Unset the env var
    to resume real delivery — at which point a missing parent email becomes
    a true skip.
    """
    cfg = _smtp_config()
    if not cfg:
        logger.info("Email skipped: SMTP not configured (set SMTP_* env vars)")
        return ("skipped", "smtp_not_configured")

    override = os.getenv("EMAIL_OVERRIDE_RECIPIENT", "").strip()
    actual_to = override or to_email
    if not actual_to:
        # No override AND no parent on record → genuine skip in production.
        return ("skipped", "no_recipient")

    try:
        import aiosmtplib
    except ImportError:
        logger.error("aiosmtplib not installed; cannot send email")
        return ("skipped", "aiosmtplib_missing")

    msg = _build_message(
        actual_to, student_name, pretty_month, pdf_bytes, pdf_filename, cfg,
        original_recipient=to_email if override else "",
    )
    if override:
        logger.info(
            "Email override active: redirecting %s → %s (EMAIL_OVERRIDE_RECIPIENT)",
            to_email, override,
        )

    try:
        await aiosmtplib.send(
            msg,
            hostname=cfg["host"],
            port=cfg["port"],
            username=cfg["username"],
            password=cfg["password"],
            start_tls=True,
            timeout=30,
        )
        logger.info(
            "Email sent: to=%s student=%s month=%s bytes=%d",
            to_email, student_name, pretty_month, len(pdf_bytes),
        )
        return ("sent", None)
    except Exception as e:
        logger.exception("Email send failed: to=%s student=%s", to_email, student_name)
        return ("failed", str(e)[:300])
