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
        # 1. Dostawcy sprzętu (Vendors) — Oddziały Bydgoszcz
        graser = get_or_create_org(
            db,
            tax_id="5541234567",
            name="Graser Maszyny Budowlane Sp. z o.o.",
            is_vendor=True,
            oc_valid_until=date(2027, 12, 31),
            base_lat=Decimal("53.123480"),
            base_lng=Decimal("18.008438")
        )
        ramirent = get_or_create_org(
            db,
            tax_id="5213004910",
            name="Ramirent S.A. — Oddział Bydgoszcz",
            is_vendor=True,
            oc_valid_until=date(2028, 6, 30),
            base_lat=Decimal("53.116200"),
            base_lng=Decimal("18.067500")
        )
        cramo = get_or_create_org(
            db,
            tax_id="5272489123",
            name="Cramo Polska — Baza Białe Błota",
            is_vendor=True,
            oc_valid_until=date(2028, 3, 15),
            base_lat=Decimal("53.102400"),
            base_lng=Decimal("17.921800")
        )

        # 1b. Klienci B2B (Firmy wykonawcze z regionu)
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

        # 3. Użytkownicy (Dyspozytorzy, Operatorzy, Klienci B2B)
        dispatcher = get_or_create_user(
            db,
            email="dyspozytor@graser-bydgoszcz.pl",
            organization_id=graser.id,
            password_hash="hashed_secret_123",
            full_name="Marek Wiśniewski (Dyspozytor Floty)",
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
            organization_id=ramirent.id,
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

        # 4. Profile operatorów
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
                organization_id=ramirent.id,
                hourly_rate_net=Decimal("65.00"),
                is_active=True
            ))
            db.flush()
            db.add_all([
                OperatorQualification(operator_id=op2_user.id, qualification_id=q_koparko_lad.id, valid_until=date(2027, 9, 15)),
                OperatorQualification(operator_id=op2_user.id, qualification_id=q_ladowarka_1.id, valid_until=date(2027, 9, 15)),
            ])

        # 5. Maszyny budowlane — Graser Maszyny Budowlane
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

        # 5b. Maszyny budowlane — Ramirent Oddział Bydgoszcz
        m3 = get_or_create_machine(
            db,
            name="Ładowarka kołowa Volvo L60H",
            organization_id=ramirent.id,
            required_qualification_id=q_ladowarka_1.id,
            category="Ładowarki",
            daily_rate_net=Decimal("850.00"),
            deposit_amount=Decimal("2000.00"),
            transport_rate_per_km=Decimal("12.00"),
            service_buffer_hours=3,
            udt_valid_until=date(2027, 11, 1)
        )
        m6 = get_or_create_machine(
            db,
            name="Koparkoładowarka CAT 428F2",
            organization_id=ramirent.id,
            required_qualification_id=q_koparko_lad.id,
            category="Koparkoładowarki",
            daily_rate_net=Decimal("680.00"),
            deposit_amount=Decimal("1500.00"),
            transport_rate_per_km=Decimal("9.50"),
            service_buffer_hours=2,
            udt_valid_until=date(2027, 10, 12)
        )
        m7 = get_or_create_machine(
            db,
            name="Koparka kołowa Liebherr A 914 Compact",
            organization_id=ramirent.id,
            required_qualification_id=q_koparka_1.id,
            category="Koparki kołowe",
            daily_rate_net=Decimal("1090.00"),
            deposit_amount=Decimal("2500.00"),
            transport_rate_per_km=Decimal("13.00"),
            service_buffer_hours=4,
            udt_valid_until=date(2028, 5, 1)
        )

        # 5c. Maszyny budowlane — Cramo Polska (Baza Białe Błota)
        m5 = get_or_create_machine(
            db,
            name="Minikoparka Kubota KX019-4 (1.9t)",
            organization_id=cramo.id,
            required_qualification_id=q_koparka_1.id,
            category="Minikoparki",
            daily_rate_net=Decimal("360.00"),
            deposit_amount=Decimal("800.00"),
            transport_rate_per_km=Decimal("6.00"),
            service_buffer_hours=2,
            udt_valid_until=date(2028, 4, 1)
        )
        m8 = get_or_create_machine(
            db,
            name="Ładowarka teleskopowa Manitou MT 1440",
            organization_id=cramo.id,
            required_qualification_id=q_ladowarka_1.id,
            category="Ładowarki teleskopowe",
            daily_rate_net=Decimal("790.00"),
            deposit_amount=Decimal("2000.00"),
            transport_rate_per_km=Decimal("11.50"),
            service_buffer_hours=3,
            udt_valid_until=date(2028, 7, 19)
        )

        # Aktualizacja przypisania dostawców dla już istniejących maszyn w bazie
        m3.organization_id = ramirent.id
        m6.organization_id = ramirent.id
        m5.organization_id = cramo.id

        db.commit()
        print("Sukces! Baza Digvo została rozbudowana o dostawców Graser, Ramirent oraz Cramo.")
    except Exception as e:
        db.rollback()
        print(f"Błąd podczas zasilania bazy: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()