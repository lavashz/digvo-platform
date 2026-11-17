from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy import select
from app.database import SessionLocal
from app.models import (
    Organization, User, UserRole, Qualification,
    Machine, OperatorProfile, OperatorQualification, Booking, BookingStatus
)


def get_or_create_org(db, tax_id: str, **kwargs) -> Organization:
    org = db.execute(select(Organization).where(Organization.tax_id == tax_id)).scalar_one_or_none()
    if not org:
        org = Organization(tax_id=tax_id, **kwargs)
        db.add(org)
        db.flush()
    return org


def get_or_create_qual(db, code: str, name: str) -> Qualification:
    qual = db.execute(select(Qualification).where(Qualification.code == code)).scalar_one_or_none()
    if not qual:
        qual = Qualification(code=code, name=name)
        db.add(qual)
        db.flush()
    return qual


def get_or_create_user(db, email: str, **kwargs) -> User:
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if not user:
        user = User(email=email, **kwargs)
        db.add(user)
        db.flush()
    return user


def get_or_create_machine(db, name: str, **kwargs) -> Machine:
    machine = db.execute(select(Machine).where(Machine.name == name)).scalar_one_or_none()
    if not machine:
        machine = Machine(name=name, **kwargs)
        db.add(machine)
        db.flush()
    return machine


def run_seed():
    db = SessionLocal()
    try:
        # 1. Organizacja główna (Wypożyczalnia w Bydgoszczy)
        graser = get_or_create_org(
            db,
            tax_id="5541234567",
            name="Graser Maszyny Budowlane Sp. z o.o.",
            is_vendor=True,
            oc_valid_until=date(2027, 12, 31),
            base_lat=Decimal("53.123480"),
            base_lng=Decimal("18.008438")
        )

        # 1b. Przykładowe firmy budowlane / klienci B2B z regionu
        client_orgs_data = [
            {
                "tax_id": "5540312456",
                "name": "PW Lech Budownictwo Sp. z o.o. (Bydgoszcz)",
                "email": "zamowienia@pwlech-bydgoszcz.pl",
                "full_name": "Krzysztof Lewandowski (PW Lech)",
                "phone": "+48 52 341 22 10",
            },
            {
                "tax_id": "5540231188",
                "name": "Ebud-Przemysłówka S.A. (BPPT Bydgoszcz)",
                "email": "logistyka@ebud-bydgoszcz.pl",
                "full_name": "Anna Kaczmarek (Ebud-Przemysłówka)",
                "phone": "+48 52 360 44 12",
            },
            {
                "tax_id": "9531004512",
                "name": "KPPRD Inżynieria Drogowa Sp. z o.o.",
                "email": "sprzet@kpprd.pl",
                "full_name": "Michał Szymański (KPPRD)",
                "phone": "+48 601 882 310",
            },
            {
                "tax_id": "9671239876",
                "name": "Aqua-Instal Roboty Ziemne Fordon",
                "email": "biuro@aquainstal-fordon.pl",
                "full_name": "Łukasz Kamiński (Aqua-Instal)",
                "phone": "+48 692 114 900",
            },
        ]

        # 2. Uprawnienia UDT / IMBiGS
        q_koparka_1 = get_or_create_qual(db, "KOP-JED-I", "Koparki jednonaczyniowe kl. I (wszystkie)")
        q_koparko_lad = get_or_create_qual(db, "KOP-LAD-I", "Koparkoładowarki kl. I")
        q_ladowarka_1 = get_or_create_qual(db, "LAD-JED-I", "Ładowarki jednonaczyniowe kl. I")

        # 3. Użytkownicy (Dyspozytor, 2 Operatorów, Klienci B2B)
        dispatcher = get_or_create_user(
            db,
            email="dyspozytor@graser-bydgoszcz.pl",
            organization_id=graser.id,
            password_hash="hashed_secret_123",
            full_name="Marek Wiśniewski (Dyspozytor)",
            phone="+48 500 100 200",
            role=UserRole.DISPATCHER
        )
        op1_user = get_or_create_user(
            db,
            email="j.kowalski@graser-bydgoszcz.pl",
            organization_id=graser.id,
            password_hash="hashed_secret_123",
            full_name="Jan Kowalski",
            phone="+48 500 300 400",
            role=UserRole.OPERATOR
        )
        op2_user = get_or_create_user(
            db,
            email="p.nowak@graser-bydgoszcz.pl",
            organization_id=graser.id,
            password_hash="hashed_secret_123",
            full_name="Piotr Nowak",
            phone="+48 500 500 600",
            role=UserRole.OPERATOR
        )
        client_user = get_or_create_user(
            db,
            email="inwestor@budowa-fordon.pl",
            password_hash="hashed_secret_123",
            full_name="Tomasz Zieliński (Inwestor Fordon)",
            phone="+48 600 700 800",
            role=UserRole.CLIENT
        )

        # Tworzenie firm B2B i przypisanych do nich kont klientów
        created_clients = [client_user]
        for c in client_orgs_data:
            org = get_or_create_org(
                db,
                tax_id=c["tax_id"],
                name=c["name"],
                is_vendor=False,
                base_lat=Decimal("53.125000"),
                base_lng=Decimal("18.012000")
            )
            u = get_or_create_user(
                db,
                email=c["email"],
                organization_id=org.id,
                password_hash="hashed_secret_123",
                full_name=c["full_name"],
                phone=c["phone"],
                role=UserRole.CLIENT
            )
            created_clients.append(u)

        # 4. Profile operatorów i ich uprawnienia (jeśli jeszcze nie istnieją)
        if not db.execute(select(OperatorProfile).where(OperatorProfile.user_id == op1_user.id)).scalar_one_or_none():
            db.add(OperatorProfile(
                user_id=op1_user.id,
                organization_id=graser.id,
                hourly_rate_net=Decimal("65.00"),
                is_active=True
            ))
            db.flush()
            db.add_all([
                OperatorQualification(operator_id=op1_user.id, qualification_id=q_koparka_1.id, valid_until=date(2028, 6, 30)),
                OperatorQualification(operator_id=op1_user.id, qualification_id=q_koparko_lad.id, valid_until=date(2028, 6, 30)),
            ])

        if not db.execute(select(OperatorProfile).where(OperatorProfile.user_id == op2_user.id)).scalar_one_or_none():
            db.add(OperatorProfile(
                user_id=op2_user.id,
                organization_id=graser.id,
                hourly_rate_net=Decimal("60.00"),
                is_active=True
            ))
            db.flush()
            db.add_all([
                OperatorQualification(operator_id=op2_user.id, qualification_id=q_koparko_lad.id, valid_until=date(2027, 9, 15)),
                OperatorQualification(operator_id=op2_user.id, qualification_id=q_ladowarka_1.id, valid_until=date(2027, 9, 15)),
            ])

        # 5. Maszyny budowlane (rozszerzony katalog oddziału Bydgoszcz)
        m1 = get_or_create_machine(
            db,
            name="Koparka gąsienicowa CAT 320 (20t)",
            organization_id=graser.id,
            required_qualification_id=q_koparka_1.id,
            category="Koparki gąsienicowe",
            daily_rate_net=Decimal("1200.00"),
            deposit_amount=Decimal("3000.00"),
            transport_rate_per_km=Decimal("14.00"),
            service_buffer_hours=4,
            udt_valid_until=date(2027, 5, 20)
        )
        m2 = get_or_create_machine(
            db,
            name="Koparkoładowarka JCB 3CX",
            organization_id=graser.id,
            required_qualification_id=q_koparko_lad.id,
            category="Koparkoładowarki",
            daily_rate_net=Decimal("650.00"),
            deposit_amount=Decimal("1500.00"),
            transport_rate_per_km=Decimal("9.00"),
            service_buffer_hours=2,
            udt_valid_until=date(2027, 8, 10)
        )
        m3 = get_or_create_machine(
            db,
            name="Ładowarka kołowa Volvo L60H",
            organization_id=graser.id,
            required_qualification_id=q_ladowarka_1.id,
            category="Ładowarki",
            daily_rate_net=Decimal("850.00"),
            deposit_amount=Decimal("2000.00"),
            transport_rate_per_km=Decimal("12.00"),
            service_buffer_hours=3,
            udt_valid_until=date(2027, 11, 1)
        )
        m4 = get_or_create_machine(
            db,
            name="Minikoparka Bobcat E27z (2.7t)",
            organization_id=graser.id,
            required_qualification_id=q_koparka_1.id,
            category="Minikoparki",
            daily_rate_net=Decimal("420.00"),
            deposit_amount=Decimal("1000.00"),
            transport_rate_per_km=Decimal("6.50"),
            service_buffer_hours=2,
            udt_valid_until=date(2028, 2, 15)
        )
        m5 = get_or_create_machine(
            db,
            name="Minikoparka Kubota KX019-4 (1.9t)",
            organization_id=graser.id,
            required_qualification_id=q_koparka_1.id,
            category="Minikoparki",
            daily_rate_net=Decimal("360.00"),
            deposit_amount=Decimal("800.00"),
            transport_rate_per_km=Decimal("6.00"),
            service_buffer_hours=2,
            udt_valid_until=date(2028, 4, 1)
        )
        m6 = get_or_create_machine(
            db,
            name="Koparkoładowarka CAT 428F2",
            organization_id=graser.id,
            required_qualification_id=q_koparko_lad.id,
            category="Koparkoładowarki",
            daily_rate_net=Decimal("680.00"),
            deposit_amount=Decimal("1500.00"),
            transport_rate_per_km=Decimal("9.50"),
            service_buffer_hours=2,
            udt_valid_until=date(2027, 10, 12)
        )

        # 6. Przykładowe rezerwacje (tylko jeśli w bazie nie ma jeszcze żadnej rezerwacji)
        existing_bookings = db.execute(select(Booking)).scalars().all()
        if not existing_bookings:
            tomorrow_start = datetime.now(timezone.utc).replace(hour=7, minute=0, second=0, microsecond=0) + timedelta(days=1)
            tomorrow_end = tomorrow_start + timedelta(hours=8)

            b1 = Booking(
                client_id=created_clients[1].id,  # PW Lech
                machine_id=m1.id,
                operator_id=op1_user.id,
                start_time=tomorrow_start,
                end_time=tomorrow_end,
                with_operator=True,
                with_transport=True,
                delivery_address="ul. Fordońska 142, Bydgoszcz",
                delivery_lat=Decimal("53.126500"),
                delivery_lng=Decimal("18.081200"),
                total_price_net=Decimal("1920.00"),
                deposit_paid=Decimal("3000.00"),
                status=BookingStatus.CONFIRMED
            )
            b2 = Booking(
                client_id=created_clients[2].id,  # Ebud-Przemysłówka
                machine_id=m3.id,
                operator_id=op2_user.id,
                start_time=tomorrow_start + timedelta(days=2),
                end_time=tomorrow_end + timedelta(days=2),
                with_operator=True,
                with_transport=True,
                delivery_address="ul. Ernsta Petersona 8 (BPPT), Bydgoszcz",
                delivery_lat=Decimal("53.078200"),
                delivery_lng=Decimal("18.069100"),
                total_price_net=Decimal("1450.00"),
                deposit_paid=Decimal("2000.00"),
                status=BookingStatus.PENDING
            )
            db.add_all([b1, b2])

        db.commit()
        print("Sukces! Baza Digvo została zaktualizowana o firmy B2B z Bydgoszczy i rozszerzoną flotę.")
    except Exception as e:
        db.rollback()
        print(f"Błąd podczas zasilania bazy: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()