import base64
import logging
import os

import httpx

logger = logging.getLogger("digvo.mailer")


def send_booking_confirmation(
    *,
    to_email: str,
    booking_id: str,
    machine_name: str,
    start_time: str,
    end_time: str,
    total_net: str,
    pdf_bytes: bytes,
) -> bool:
    """Wysyła umowę PDF. Bez klucza / przy błędzie → False (nie rzuca)."""
    api_key = (os.getenv("RESEND_API_KEY") or "").strip()
    if not api_key:
        logger.info("RESEND_API_KEY brak — pomijam e-mail dla %s", booking_id)
        return False

    mail_from = (os.getenv("MAIL_FROM") or "Digvo <onboarding@resend.dev>").strip()
    subject = f"Digvo — potwierdzenie rezerwacji {booking_id[:8]}"
    body = (
        f"Dziękujemy za rezerwację w Digvo.\n\n"
        f"Maszyna: {machine_name}\n"
        f"Termin: {start_time} → {end_time}\n"
        f"Kwota netto: {total_net} zł\n\n"
        f"Umowa PDF w załączniku.\n"
    )

    payload: dict = {
        "from": mail_from,
        "to": [to_email],
        "subject": subject,
        "text": body,
        "attachments": [
            {
                "filename": f"digvo_umowa_{booking_id[:8]}.pdf",
                "content": base64.b64encode(pdf_bytes).decode("ascii"),
            }
        ],
    }

    cc = (os.getenv("MAIL_DISPATCHER") or "").strip()
    if cc:
        payload["cc"] = [cc]

    try:
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=20.0,
        )
        if r.status_code >= 400:
            logger.warning("Resend %s: %s", r.status_code, r.text[:300])
            return False
        logger.info("E-mail wysłany do %s (booking %s)", to_email, booking_id[:8])
        return True
    except Exception as exc:
        logger.warning("E-mail nie wysłany: %s", exc)
        return False