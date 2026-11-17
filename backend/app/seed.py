from datetime import date
from decimal import Decimal
from sqlalchemy import select, text
from app.database import SessionLocal, engine
from app.models import (
    Organization, User, UserRole, Qualification,
    Machine, OperatorProfile, OperatorQualification
)


# Stare e-maile demo → nowe (po zmianie marek na fikcyjne)
EMAIL_MIGRATIONS = {
    "dyspozytor@graser-bydgoszcz.pl": "dyspozytor@kujawy-maszyny.pl",
    "j.kowalski@graser-bydgoszcz.pl": "j.kowalski@kujawy-maszyny.pl",
    "p.nowak@graser-bydgoszcz.pl": "p.nowak@terrarent-bydgoszcz.pl",
}


def ensure_schema():
    """Dopina kolumny/constraint-y na istniejącej bazie Neon bez pełnej migracji Alembic."""
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
        conn.execute(text("""
            ALTER TABLE organizations
                ADD COLUMN IF NOT EXISTS short_name VARCHAR(128),
                ADD COLUMN IF NOT EXISTS district VARCHAR(255),
                ADD COLUMN IF NOT EXISTS rating NUMERIC(2, 1) DEFAULT 4.8
        """))
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'excl_operator_booking_overlap'
                ) THEN
                    ALTER TABLE bookings ADD CONSTRAINT excl_operator_booking_overlap
                    EXCLUDE USING gist (
                        operator_id WITH =,
                        tstzrange(start_time, end_time, '[)') WITH &&
                    ) WHERE (status != 'CANCELLED' AND operator_id IS NOT NULL);
                END IF;
            END $$;
        """))


def get_or_create_org(db, tax_id: str, **kwargs) -> Organization:
    org = db.execute(select(Organization).where(Organization.tax_id == tax_id)).scalar_one_or_none()
    if not org:
        org = Organization(tax_id=tax_id, **kwargs)
        db.add(org)
        db.flush()
    else:
        for key, value in kwargs.items():
            setattr(org, key, value)
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
    else:
        for key, value in kwargs.items():
            setattr(user, key, value)
    return user


def migrate_demo_emails(db):
    for old_email, new_email in EMAIL_MIGRATIONS.items():
        if old_email == new_email:
            continue
        existing_new = db.execute(select(User).where(User.email == new_email)).scalar_one_or_none()
        old_user = db.execute(select(User).where(User.email == old_email)).scalar_one_or_none()
        if old_user and not existing_new:
            old_user.email = new_email
        elif old_user and existing_new and old_user.id != existing_new.id:
            # Nowy e-mail już istnieje — zostawiamy nowy, starego nie ruszamy (unikamy kolizji FK)
            pass


def get_or_create_machine(db, name: str, **kwargs) -> Machine:
    machine = db.execute(select(Machine).where(Machine.name == name)).scalar_one_or_none()
    if not machine:
        machine = Machine(name=name, **kwargs)
        db.add(machine)
        db.flush()
    else:
        for key, value in kwargs.items():
            setattr(machine, key, value)
    return machine


def run_seed():
    ensure_schema()
    db = SessionLocal()
    try:
        migrate_demo_emails(db)

        # 1. Fikcyjni dostawcy (marketplace) — region Bydgoszcz
        kujawy = get_or_create_org(
            db,
            tax_id="5541234567",
            name="Kujawy Maszyny Sp. z o.o.",
            short_name="Kujawy Maszyny",
            district="Bydgoszcz • Fordon",
            rating=Decimal("4.9"),
            is_vendor=True,
            oc_valid_until=date(2027, 12, 31),
            base_lat=Decimal("53.123480"),
            base_lng=Decimal("18.008438"),
        )
        terrarent = get_or_create_org(
            db,
            tax_id="5213004910",
            name="TerraRent Bydgoszcz Sp. z o.o.",
            short_name="TerraRent Bydgoszcz",
            district="Bydgoszcz • ul. Przemysłowa",
            rating=Decimal("4.8"),
            is_vendor=True,
            oc_valid_until=date(2028, 6, 30),
            base_lat=Decimal("53.116200"),
            base_lng=Decimal("18.067500"),
        )
        budlift = get_or_create_org(
            db,
            tax_id="5272489123",
            name="Budlift Białe Błota Sp. z o.o.",
            short_name="Budlift Białe Błota",
            district="Białe Błota k. Bydgoszczy",
            rating=Decimal("4.9"),
            is_vendor=True,
            oc_valid_until=date(2028, 3, 15),
            base_lat=Decimal("53.102400"),
            base_lng=Decimal("17.921800"),
        )

        # 1b. Klienci B2B (firmy wykonawcze — też fikcyjne)
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
            email="dyspozytor@kujawy-maszyny.pl",
            organization_id=kujawy.id,
            password_hash="hashed_secret_123",
            full_name="Marek Wiśniewski (Dyspozytor Floty)",
            phone="+48 500 100 200",
            role=UserRole.DISPATCHER,
        )
        op1_user = get_or_create_user(
            db,
            email="j.kowalski@kujawy-maszyny.pl",
            organization_id=kujawy.id,
            password_hash="hashed_secret_123",
            full_name="Jan Kowalski",
            phone="+48 500 300 400",
            role=UserRole.OPERATOR,
        )
        op2_user = get_or_create_user(
            db,
            email="p.nowak@terrarent-bydgoszcz.pl",
            organization_id=terrarent.id,
            password_hash="hashed_secret_123",
            full_name="Piotr Nowak",
            phone="+48 500 500 600",
            role=UserRole.OPERATOR,
        )
        client_user = get_or_create_user(
            db,
            email="inwestor@budowa-fordon.pl",
            password_hash="hashed_secret_123",
            full_name="Tomasz Zieliński (Inwestor Fordon)",
            phone="+48 600 700 800",
            role=UserRole.CLIENT,
        )

        for c in client_orgs_data:
            org = get_or_create_org(
                db,
                tax_id=c["tax_id"],
                name=c["name"],
                is_vendor=False,
                base_lat=Decimal("53.125000"),
                base_lng=Decimal("18.012000"),
            )
            get_or_create_user(
                db,
                email=c["email"],
                organization_id=org.id,
                password_hash="hashed_secret_123",
                full_name=c["full_name"],
                phone=c["phone"],
                role=UserRole.CLIENT,
            )

        # 4. Profile operatorów
        if not db.execute(select(OperatorProfile).where(OperatorProfile.user_id == op1_user.id)).scalar_one_or_none():
            db.add(OperatorProfile(
                user_id=op1_user.id,
                organization_id=kujawy.id,
                hourly_rate_net=Decimal("65.00"),
                is_active=True,
            ))
            db.flush()
            db.add_all([
                OperatorQualification(operator_id=op1_user.id, qualification_id=q_koparka_1.id, valid_until=date(2028, 6, 30)),
                OperatorQualification(operator_id=op1_user.id, qualification_id=q_koparko_lad.id, valid_until=date(2028, 6, 30)),
            ])
        else:
            op1 = db.get(OperatorProfile, op1_user.id)
            if op1:
                op1.organization_id = kujawy.id

        if not db.execute(select(OperatorProfile).where(OperatorProfile.user_id == op2_user.id)).scalar_one_or_none():
            db.add(OperatorProfile(
                user_id=op2_user.id,
                organization_id=terrarent.id,
                hourly_rate_net=Decimal("65.00"),
                is_active=True,
            ))
            db.flush()
            db.add_all([
                OperatorQualification(operator_id=op2_user.id, qualification_id=q_koparko_lad.id, valid_until=date(2027, 9, 15)),
                OperatorQualification(operator_id=op2_user.id, qualification_id=q_ladowarka_1.id, valid_until=date(2027, 9, 15)),
            ])
        else:
            op2 = db.get(OperatorProfile, op2_user.id)
            if op2:
                op2.organization_id = terrarent.id

        # 5. Flota — Kujawy Maszyny
        get_or_create_machine(
            db,
            name="Koparka gąsienicowa CAT 320 (20t)",
            organization_id=kujawy.id,
            required_qualification_id=q_koparka_1.id,
            category="Koparki gąsienicowe",
            daily_rate_net=Decimal("1200.00"),
            deposit_amount=Decimal("3000.00"),
            transport_rate_per_km=Decimal("14.00"),
            service_buffer_hours=4,
            udt_valid_until=date(2027, 5, 20),
        )
        get_or_create_machine(
            db,
            name="Koparkoładowarka JCB 3CX",
            organization_id=kujawy.id,
            required_qualification_id=q_koparko_lad.id,
            category="Koparkoładowarki",
            daily_rate_net=Decimal("650.00"),
            deposit_amount=Decimal("1500.00"),
            transport_rate_per_km=Decimal("9.00"),
            service_buffer_hours=2,
            udt_valid_until=date(2027, 8, 10),
        )
        get_or_create_machine(
            db,
            name="Minikoparka Bobcat E27z (2.7t)",
            organization_id=kujawy.id,
            required_qualification_id=q_koparka_1.id,
            category="Minikoparki",
            daily_rate_net=Decimal("420.00"),
            deposit_amount=Decimal("1000.00"),
            transport_rate_per_km=Decimal("6.50"),
            service_buffer_hours=2,
            udt_valid_until=date(2028, 2, 15),
        )

        # 5b. Flota — TerraRent Bydgoszcz
        get_or_create_machine(
            db,
            name="Ładowarka kołowa Volvo L60H",
            organization_id=terrarent.id,
            required_qualification_id=q_ladowarka_1.id,
            category="Ładowarki",
            daily_rate_net=Decimal("850.00"),
            deposit_amount=Decimal("2000.00"),
            transport_rate_per_km=Decimal("12.00"),
            service_buffer_hours=3,
            udt_valid_until=date(2027, 11, 1),
        )
        get_or_create_machine(
            db,
            name="Koparkoładowarka CAT 428F2",
            organization_id=terrarent.id,
            required_qualification_id=q_koparko_lad.id,
            category="Koparkoładowarki",
            daily_rate_net=Decimal("680.00"),
            deposit_amount=Decimal("1500.00"),
            transport_rate_per_km=Decimal("9.50"),
            service_buffer_hours=2,
            udt_valid_until=date(2027, 10, 12),
        )
        get_or_create_machine(
            db,
            name="Koparka kołowa Liebherr A 914 Compact",
            organization_id=terrarent.id,
            required_qualification_id=q_koparka_1.id,
            category="Koparki kołowe",
            daily_rate_net=Decimal("1090.00"),
            deposit_amount=Decimal("2500.00"),
            transport_rate_per_km=Decimal("13.00"),
            service_buffer_hours=4,
            udt_valid_until=date(2028, 5, 1),
        )

        # 5c. Flota — Budlift Białe Błota
        get_or_create_machine(
            db,
            name="Minikoparka Kubota KX019-4 (1.9t)",
            organization_id=budlift.id,
            required_qualification_id=q_koparka_1.id,
            category="Minikoparki",
            daily_rate_net=Decimal("360.00"),
            deposit_amount=Decimal("800.00"),
            transport_rate_per_km=Decimal("6.00"),
            service_buffer_hours=2,
            udt_valid_until=date(2028, 4, 1),
        )
        get_or_create_machine(
            db,
            name="Ładowarka teleskopowa Manitou MT 1440",
            organization_id=budlift.id,
            required_qualification_id=q_ladowarka_1.id,
            category="Ładowarki teleskopowe",
            daily_rate_net=Decimal("790.00"),
            deposit_amount=Decimal("2000.00"),
            transport_rate_per_km=Decimal("11.50"),
            service_buffer_hours=3,
            udt_valid_until=date(2028, 7, 19),
        )

        db.commit()
        print(
            "Sukces! Seed Digvo: Kujawy Maszyny, TerraRent Bydgoszcz, Budlift Białe Błota. "
            f"Demo dyspozytor: {dispatcher.email} / haslo123"
        )
    except Exception as e:
        db.rollback()
        print(f"Błąd podczas zasilania bazy: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
