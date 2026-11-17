import unicodedata
from fpdf import FPDF
from app.models import Booking, Machine, User, HandoverProtocol


def clean_pl(text: str | None) -> str:
    """Konwertuje polskie znaki na ASCII dla wbudowanej czcionki PDF bez zewnętrznych plików TTF."""
    if not text:
        return "-"
    replacements = {
        "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z",
        "Ą": "A", "Ć": "C", "Ę": "E", "Ł": "L", "Ń": "N", "Ó": "O", "Ś": "S", "Ź": "Z", "Ż": "Z",
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")


def generate_booking_pdf(
    booking: Booking,
    machine: Machine,
    client: User | None,
    operator: User | None,
    protocols: list[HandoverProtocol],
    vendor_name: str = "Dostawca Digvo",
) -> bytes:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Nagłówek dokumentu
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "DIGVO - UMOWA NAJMU I PROTOKOL ZDAWCZO-ODBIORCZY", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, f"Numer zlecenia: {booking.id}  |  Status: {booking.status.value}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # Sekcja 1: Strony umowy
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "1. STRONY UMOWY", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, clean_pl(f"Wynajmujacy: {vendor_name} (przez platforme Digvo)"), new_x="LMARGIN", new_y="NEXT")
    client_label = f"{client.full_name} ({client.email})" if client else "Klient zarejestrowany"
    pdf.cell(0, 6, clean_pl(f"Najemca: {client_label}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # Sekcja 2: Przedmiot najmu i logistyka
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "2. PRZEDMIOT NAJMU I REALIZACJA", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, clean_pl(f"Maszyna budowlana: {machine.name} (Kategoria: {machine.category})"), new_x="LMARGIN", new_y="NEXT")
    pdf.cell(
        0, 6,
        f"Okres najmu: {booking.start_time.strftime('%Y-%m-%d %H:%M')} - {booking.end_time.strftime('%Y-%m-%d %H:%M')}",
        new_x="LMARGIN", new_y="NEXT"
    )
    op_label = f"{operator.full_name} (Uprawnienia UDT)" if operator else "Najem bez operatora"
    pdf.cell(0, 6, clean_pl(f"Operator: {op_label}"), new_x="LMARGIN", new_y="NEXT")
    loc_label = booking.delivery_address if booking.with_transport else f"Odbior wlasny z bazy {vendor_name}"
    pdf.cell(0, 6, clean_pl(f"Miejsce dostawy: {loc_label}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # Sekcja 3: Rozliczenie finansowe
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "3. WARUNKI FINANSOWE", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"Stawka dobowa maszyny: {machine.daily_rate_net} PLN netto", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Kaucja zwrotna: {machine.deposit_amount} PLN", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 8, f"CALKOWITA WARTOSC ZLECENIA: {booking.total_price_net} PLN netto", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # Sekcja 4: Protokół motogodzin
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "4. PROTOKOL ZDAWCZO-ODBIORCZY (MOTOGODZINY)", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)

    pickup = next((p for p in protocols if p.protocol_type == "PICKUP"), None)
    ret = next((p for p in protocols if p.protocol_type == "RETURN"), None)

    pickup_txt = f"{pickup.engine_hours_reading} mth ({pickup.created_at.strftime('%Y-%m-%d %H:%M')})" if pickup else "Oczekuje na wydanie"
    ret_txt = f"{ret.engine_hours_reading} mth ({ret.created_at.strftime('%Y-%m-%d %H:%M')})" if ret else "Oczekuje na zwrot"

    pdf.cell(0, 6, f"Stan licznika przy wydaniu (PICKUP): {pickup_txt}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Stan licznika przy zwrocie (RETURN): {ret_txt}", new_x="LMARGIN", new_y="NEXT")

    if pickup and ret:
        worked = round(float(ret.engine_hours_reading) - float(pickup.engine_hours_reading), 2)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 6, f"Przepracowane motogodziny w trakcie zlecenia: {worked} mth", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(18)

    # Podpisy
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(90, 6, "............................................................", new_x="RIGHT", new_y="TOP")
    pdf.cell(0, 6, "............................................................", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(90, 5, clean_pl(f"Podpis przedstawiciela {vendor_name} / Operatora"), new_x="RIGHT", new_y="TOP")
    pdf.cell(0, 5, "Podpis Najemcy (Kierownika Budowy)", new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())