import base64
import logging
import os

import httpx

logger = logging.getLogger("digvo.mailer")


def _mail_from() -> str:
    return (os.getenv("MAIL_FROM") or "Digvo <onboarding@resend.dev>").strip()


def _api_key() -> str:
    return (os.getenv("RESEND_API_KEY") or "").strip()


def send_email(
    *,
    to_email: str,
    subject: str,
    body: str,
    cc: list[str] | None = None,
    pdf_bytes: bytes | None = None,
    pdf_filename: str | None = None,
) -> bool:
    """Wysyłka przez Resend. Bez klucza / przy błędzie → False (nie rzuca)."""
    api_key = _api_key()
    if not api_key:
        logger.info("RESEND_API_KEY brak — pomijam: %s", subject)
        return False
    if not to_email:
        return False

    payload: dict = {
        "from": _mail_from(),
        "to": [to_email],
        "subject": subject,
        "text": body,
    }
    if cc:
        payload["cc"] = cc
    if pdf_bytes is not None:
        payload["attachments"] = [
            {
                "filename": pdf_filename or "digvo.pdf",
                "content": base64.b64encode(pdf_bytes).decode("ascii"),
            }
        ]

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
        logger.info("E-mail wysłany do %s (%s)", to_email, subject)
        return True
    except Exception as exc:
        logger.warning("E-mail nie wysłany: %s", exc)
        return False


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
    subject = f"Digvo — potwierdzenie rezerwacji {booking_id[:8]}"
    body = (
        f"Dziękujemy za rezerwację w Digvo.\n\n"
        f"Maszyna: {machine_name}\n"
        f"Termin: {start_time} → {end_time}\n"
        f"Kwota netto: {total_net} zł\n"
        f"Status: potwierdzona\n"
        f"Kaucja: oczekuje na przelew (status w Moich rezerwacjach).\n\n"
        f"Umowa PDF w załączniku.\n"
    )
    cc_raw = (os.getenv("MAIL_DISPATCHER") or "").strip()
    cc = [cc_raw] if cc_raw else None
    return send_email(
        to_email=to_email,
        subject=subject,
        body=body,
        cc=cc,
        pdf_bytes=pdf_bytes,
        pdf_filename=f"digvo_umowa_{booking_id[:8]}.pdf",
    )


def send_booking_status_notice(
    *,
    to_email: str,
    booking_id: str,
    machine_name: str,
    status: str,
    start_time: str | None = None,
    end_time: str | None = None,
) -> bool:
    labels = {
        "CONFIRMED": "potwierdzona",
        "IN_PROGRESS": "w trakcie (start)",
        "COMPLETED": "zakończona",
        "CANCELLED": "anulowana",
        "PENDING": "oczekująca",
    }
    label = labels.get(status, status)
    subject = f"Digvo — status rezerwacji {booking_id[:8]}: {label}"
    lines = [
        f"Status Twojej rezerwacji został zaktualizowany.",
        "",
        f"Maszyna: {machine_name}",
        f"Nowy status: {label} ({status})",
    ]
    if start_time and end_time:
        lines.append(f"Termin: {start_time} → {end_time}")
    lines += ["", "Szczegóły: Moje rezerwacje w Digvo."]
    return send_email(to_email=to_email, subject=subject, body="\n".join(lines))


def send_payment_notice(
    *,
    to_email: str,
    booking_id: str,
    machine_name: str,
    payment_status: str,
    notify_role: str = "client",
) -> bool:
    if payment_status == "TRANSFER_REPORTED":
        if notify_role == "staff":
            subject = f"Digvo — zgłoszono przelew kaucji {booking_id[:8]}"
            body = (
                f"Klient zgłosił przelew kaucji.\n\n"
                f"Maszyna: {machine_name}\n"
                f"Rezerwacja: {booking_id[:8]}\n\n"
                f"Potwierdź kaucję w panelu dyspozytora.\n"
            )
        else:
            subject = f"Digvo — przyjęto zgłoszenie przelewu {booking_id[:8]}"
            body = (
                f"Przyjęliśmy zgłoszenie przelewu kaucji.\n\n"
                f"Maszyna: {machine_name}\n"
                f"Status: przelew zgłoszony — czekamy na potwierdzenie wypożyczalni.\n"
            )
    elif payment_status == "DEPOSIT_CONFIRMED":
        subject = f"Digvo — kaucja potwierdzona {booking_id[:8]}"
        body = (
            f"Kaucja została potwierdzona.\n\n"
            f"Maszyna: {machine_name}\n"
            f"Rezerwacja: {booking_id[:8]}\n"
        )
    elif payment_status == "AWAITING_TRANSFER":
        subject = f"Digvo — kaucja do przelewu {booking_id[:8]}"
        body = (
            f"Oczekujemy na przelew kaucji.\n\n"
            f"Maszyna: {machine_name}\n"
            f"Status: do przelewu — po wpłacie kliknij „Zgłosiłem przelew”.\n"
        )
    else:
        subject = f"Digvo — płatność {booking_id[:8]}"
        body = f"Maszyna: {machine_name}\nStatus płatności: {payment_status}\n"

    return send_email(to_email=to_email, subject=subject, body=body)