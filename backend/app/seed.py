from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy import select
from app.database import SessionLocal
from app.models import (
    Organization, User, UserRole, Qualification,
    Machine, OperatorProfile, OperatorQualification, Booking, BookingStatus
)

def run_seed():
    db = SessionLocal()
    try:
        # Sprawdzamy, czy dane już istnieją
        existing_org = db.execute(select(Organization).where(Organization.tax_id == "5541234567")).scalar_one_or_none()
        if existing_org:
            print("Dane testowe już znajdują się w bazie!")
            return

        # 1. Organizacja (Wypożyczalnia w Bydgoszczy)
        graser = Organization(
            name="Graser Maszyny Budowlane Sp. z o.o.",
            tax_id="5541234567",
            is_vendor=True,
            oc_valid_until=date(2027, 12, 31),
            base_lat=Decimal("53.123480"),
            base_lng=Decimal("18.008438")
        )
        db.add(graser)
        db.flush()

        # 2. Uprawnienia UDT / IMBiGS
        q_koparka_1 = Qualification(code="KOP-JED-I", name="Koparki jednonaczyniowe kl. I (wszystkie)")
        q_koparko_lad = Qualification(code="KOP-LAD-I", name="Koparkoładowarki kl. I")
        q_ladowarka_1 = Qualification(code="LAD-JED-I", name="Ładowarki jednonaczyniowe kl. I")
        db.add_all([q_koparka_1, q_koparko_lad, q_ladowarka_1])
        db.flush()

        # 3. Użytkownicy (Dyspozytor, 2 Operatorów, Klient)
        dispatcher = User(
            organization_id=graser.id,
            email="dyspozytor@graser-bydgoszcz.pl",
            password_hash="hashed_secret_123",
            full_name="Marek Wiśniewski (Dyspozytor)",
            phone="+48 500 100 200",
            role=UserRole.DISPATCHER
        )
        op1_user = User(
            organization_id=graser.id,
            email="j.kowalski@graser-bydgoszcz.pl",
            password_hash="hashed_secret_123",
            full_name="Jan Kowalski",
            phone="+48 500 300 400",
            role=UserRole.OPERATOR
        )
        op2_user = User(
            organization_id=graser.id,
            email="p.nowak@graser-bydgoszcz.pl",
            password_hash="hashed_secret_123",
            full_name="Piotr Nowak",
            phone="+48 500 500 600",
            role=UserRole.OPERATOR
        )
        client_user = User(
            email="inwestor@budowa-fordon.pl",
            password_hash="hashed_secret_123",
            full_name="Tomasz Zieliński (Inwestor)",
            phone="+48 600 700 800",
            role=UserRole.CLIENT
        )
        db.add_all([dispatcher, op1_user, op2_user, client_user])
        db.flush()

        # 4. Profile operatorów i ich uprawnienia
        op1_profile = OperatorProfile(
            user_id=op1_user.id,
            organization_id=graser.id,
            hourly_rate_net=Decimal("65.00"),
            is_active=True
        )
        op2_profile = OperatorProfile(
            user_id=op2_user.id,
            organization_id=graser.id,
            hourly_rate_net=Decimal("60.00"),
            is_active=True
        )
        db.add_all([op1_profile, op2_profile])
        db.flush()

        db.add_all([
            OperatorQualification(operator_id=op1_user.id, qualification_id=q_koparka_1.id, valid_until=date(2028, 6, 30)),
            OperatorQualification(operator_id=op1_user.id, qualification_id=q_koparko_lad.id, valid_until=date(2028, 6, 30)),
            OperatorQualification(operator_id=op2_user.id, qualification_id=q_koparko_lad.id, valid_until=date(2027, 9, 15)),
            OperatorQualification(operator_id=op2_user.id, qualification_id=q_ladowarka_1.id, valid_until=date(2027, 9, 15)),
        ])

        # 5. Maszyny budowlane
        m1 = Machine(
            organization_id=graser.id,
            required_qualification_id=q_koparka_1.id,
            name="Koparka gąsienicowa CAT 320 (20t)",
            category="Koparki gąsienicowe",
            daily_rate_net=Decimal("1200.00"),
            deposit_amount=Decimal("3000.00"),
            transport_rate_per_km=Decimal("14.00"),
            service_buffer_hours=4,
            udt_valid_until=date(2027, 5, 20)
        )
        m2 = Machine(
            organization_id=graser.id,
            required_qualification_id=q_koparko_lad.id,
            name="Koparkoładowarka JCB 3CX",
            category="Koparkoładowarki",
            daily_rate_net=Decimal("650.00"),
            deposit_amount=Decimal("1500.00"),
            transport_rate_per_km=Decimal("9.00"),
            service_buffer_hours=2,
            udt_valid_until=date(2027, 8, 10)
        )
        m3 = Machine(
            organization_id=graser.id,
            required_qualification_id=q_ladowarka_1.id,
            name="Ładowarka kołowa Volvo L60H",
            category="Ładowarki",
            daily_rate_net=Decimal("850.00"),
            deposit_amount=Decimal("2000.00"),
            transport_rate_per_km=Decimal("12.00"),
            service_buffer_hours=3,
            udt_valid_until=date(2027, 11, 1)
        )
        db.add_all([m1, m2, m3])
        db.flush()

        # 6. Przykładowa rezerwacja (na jutro)
        tomorrow_start = datetime.now(timezone.utc).replace(hour=7, minute=0, second=0, microsecond=0) + timedelta(days=1)
        tomorrow_end = tomorrow_start + timedelta(hours=8)

        sample_booking = Booking(
            client_id=client_user.id,
            machine_id=m1.id,
            operator_id=op1_user.id,
            start_time=tomorrow_start,
            end_time=tomorrow_end,
            with_operator=True,
            with_transport=True,
            delivery_address="ul. Przemysłowa 12, Bydgoszcz",
            delivery_lat=Decimal("53.118900"),
            delivery_lng=Decimal("18.064200"),
            total_price_net=Decimal("1920.00"),
            deposit_paid=Decimal("3000.00"),
            status=BookingStatus.CONFIRMED
        )
        db.add(sample_booking)
        db.commit()
        print("Sukces! Baza Digvo została zasilona przykładowymi danymi z Bydgoszczy.")
    except Exception as e:
        db.rollback()
        print(f"Błąd podczas zasilania bazy: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_seed()