"""Lookup NIP w Białej Liście VAT (MF)."""
from __future__ import annotations

from datetime import date
from typing import Any

import httpx

WL_URL = "https://wl-api.mf.gov.pl/api/search/nip/{nip}"


def normalize_nip(raw: str) -> str:
    digits = "".join(c for c in (raw or "") if c.isdigit())
    return digits


def nip_checksum_ok(nip: str) -> bool:
    if len(nip) != 10 or not nip.isdigit():
        return False
    weights = (6, 5, 7, 2, 3, 4, 5, 6, 7)
    total = sum(int(nip[i]) * weights[i] for i in range(9))
    return total % 11 == int(nip[9])


def lookup_nip(nip_raw: str) -> dict[str, Any]:
    """
    Zwraca dict:
      ok, nip, name, address, status_vat, error
    Nie rzuca — błędy w polu error.
    """
    nip = normalize_nip(nip_raw)
    if not nip_checksum_ok(nip):
        return {
            "ok": False,
            "nip": nip,
            "name": None,
            "address": None,
            "status_vat": None,
            "error": "Nieprawidłowy NIP (checksum).",
        }

    today = date.today().isoformat()
    url = WL_URL.format(nip=nip)
    try:
        r = httpx.get(url, params={"date": today}, timeout=12.0)
        if r.status_code == 404:
            return {
                "ok": False,
                "nip": nip,
                "name": None,
                "address": None,
                "status_vat": None,
                "error": "Nie znaleziono podmiotu w Białej Liście.",
            }
        if r.status_code >= 400:
            return {
                "ok": False,
                "nip": nip,
                "name": None,
                "address": None,
                "status_vat": None,
                "error": f"Biała Lista niedostępna ({r.status_code}).",
            }
        data = r.json()
        subject = (data.get("result") or {}).get("subject")
        if not subject:
            return {
                "ok": False,
                "nip": nip,
                "name": None,
                "address": None,
                "status_vat": None,
                "error": "Brak danych podmiotu dla tego NIP.",
            }
        name = (subject.get("name") or "").strip() or None
        address = (
            (subject.get("workingAddress") or subject.get("residenceAddress") or "")
            .strip()
            or None
        )
        status_vat = (subject.get("statusVat") or "").strip() or None
        return {
            "ok": True,
            "nip": nip,
            "name": name,
            "address": address,
            "status_vat": status_vat,
            "error": None,
        }
    except Exception:
        return {
            "ok": False,
            "nip": nip,
            "name": None,
            "address": None,
            "status_vat": None,
            "error": "Nie udało się połączyć z Białą Listą VAT.",
        }