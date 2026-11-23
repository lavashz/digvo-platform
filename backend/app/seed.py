from datetime import date
from decimal import Decimal
from sqlalchemy import select
from app.database import SessionLocal
from app.models import (
    Organization, User, UserRole, Qualification,
    Machine, OperatorProfile, OperatorQualification, TransportVehicle
)


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
    # stare adresy demo → szukamy też po nich, żeby nie robić drugiego INSERT
    legacy = {
        "dyspozytor@kujawy-maszyny.pl": "dyspozytor@graser-bydgoszcz.pl",
        "j.kowalski@kujawy-maszyny.pl": "j.kowalski@graser-bydgoszcz.pl",
        "p.nowak@terrarent-bydgoszcz.pl": "p.nowak@graser-bydgoszcz.pl",
    }

    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if not user:
        old_email = legacy.get(email)
        if old_email:
            user = db.execute(select(User).where(User.email == old_email)).scalar_one_or_none()
            if user:
                user.email = email

    if user:
        for key, value in kwargs.items():
            setattr(user, key, value)
        db.flush()
        return user

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
    else:
        for key, value in kwargs.items():
            setattr(machine, key, value)
    return machine


def get_or_create_vehicle(db, plate_number: str, **kwargs) -> TransportVehicle:
    vehicle = db.execute(
        select(TransportVehicle).where(TransportVehicle.plate_number == plate_number)
    ).scalar_one_or_none()
    if not vehicle:
        vehicle = TransportVehicle(plate_number=plate_number, **kwargs)
        db.add(vehicle)
        db.flush()
    else:
        for key, value in kwargs.items():
            setattr(vehicle, key, value)
    return vehicle


def run_seed():
    db = SessionLocal()
    try:

        kujawy = get_or_create_org(
            db,
            tax_id="5541234567",
            name="Kujawy Maszyny Sp. z o.o.",
            is_vendor=True,
            oc_valid_until=date(2027, 12, 31),
            base_lat=Decimal("53.123480"),
            base_lng=Decimal("18.008438"),
        )
        terrarent = get_or_create_org(
            db,
            tax_id="5213004910",
            name="TerraRent Bydgoszcz Sp. z o.o.",
            is_vendor=True,
            oc_valid_until=date(2028, 6, 30),
            base_lat=Decimal("53.116200"),
            base_lng=Decimal("18.067500"),
        )
        budlift = get_or_create_org(
            db,
            tax_id="5272489123",
            name="Budlift Białe Błota Sp. z o.o.",
            is_vendor=True,
            oc_valid_until=date(2028, 3, 15),
            base_lat=Decimal("53.102400"),
            base_lng=Decimal("17.921800"),
        )

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

        q_koparka_1 = get_or_create_qual(db, "KOP-JED-I", "Koparki jednonaczyniowe kl. I (wszystkie)")
        q_koparko_lad = get_or_create_qual(db, "KOP-LAD-I", "Koparkoładowarki kl. I")
        q_ladowarka_1 = get_or_create_qual(db, "LAD-JED-I", "Ładowarki jednonaczyniowe kl. I")

        get_or_create_user(
            db,
            email="dyspozytor@kujawy-maszyny.pl",
            organization_id=kujawy.id,
            password_hash="hashed_secret_123",
            full_name="Marek Wiśniewski (Dyspozytor Kujawy)",
            phone="+48 500 100 200",
            role=UserRole.DISPATCHER,
        )
        
        get_or_create_user(
            db,
            email="dyspozytor@terrarent-bydgoszcz.pl",
            organization_id=terrarent.id,
            password_hash="hashed_secret_123",
            full_name="Ewa Jabłońska (Dyspozytor TerraRent)",
            phone="+48 500 200 300",
            role=UserRole.DISPATCHER,
        )

        get_or_create_user(
            db,
            email="dyspozytor@budlift.pl",
            organization_id=budlift.id,
            password_hash="hashed_secret_123",
            full_name="Tomasz Maj (Dyspozytor Budlift)",
            phone="+48 500 200 400",
            role=UserRole.DISPATCHER,
        )
                
        get_or_create_user(
            db,
            email="admin@digvo.pl",
            organization_id=kujawy.id,
            password_hash="hashed_secret_123",
            full_name="Admin Digvo",
            phone="+48 500 000 001",
            role=UserRole.ADMIN,
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
        op1b_user = get_or_create_user(
            db,
            email="a.wisniewska@kujawy-maszyny.pl",
            organization_id=kujawy.id,
            password_hash="hashed_secret_123",
            full_name="Anna Wiśniewska",
            phone="+48 500 300 401",
            role=UserRole.OPERATOR,
        )
        if not db.execute(select(OperatorProfile).where(OperatorProfile.user_id == op1b_user.id)).scalar_one_or_none():
            db.add(OperatorProfile(
                user_id=op1b_user.id,
                organization_id=kujawy.id,
                hourly_rate_net=Decimal("70.00"),
                is_active=True,
            ))
            db.flush()
            db.add_all([
                OperatorQualification(operator_id=op1b_user.id, qualification_id=q_koparka_1.id, valid_until=date(2027, 3, 31)),
                OperatorQualification(operator_id=op1b_user.id, qualification_id=q_koparko_lad.id, valid_until=date(2027, 3, 31)),
            ])
        else:
            op1b = db.get(OperatorProfile, op1b_user.id)
            if op1b:
                op1b.organization_id = kujawy.id
                op1b.hourly_rate_net = Decimal("70.00")
                
        op2_user = get_or_create_user(
            db,
            email="p.nowak@terrarent-bydgoszcz.pl",
            organization_id=terrarent.id,
            password_hash="hashed_secret_123",
            full_name="Piotr Nowak",
            phone="+48 500 500 600",
            role=UserRole.OPERATOR,
        )
        get_or_create_user(
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
        get_or_create_vehicle(
            db,
            plate_number="CBY 12AB",
            organization_id=kujawy.id,
            name="Laweta ciężka Volvo FH",
            max_weight_tons=Decimal("40.00"),
            is_active=True,
        )
        get_or_create_vehicle(
            db,
            plate_number="CBY 34CD",
            organization_id=kujawy.id,
            name="Naczepa niskopodwoziowa",
            max_weight_tons=Decimal("30.00"),
            is_active=True,
        )
        get_or_create_vehicle(
            db,
            plate_number="CBY 56EF",
            organization_id=terrarent.id,
            name="Laweta MAN TGX",
            max_weight_tons=Decimal("35.00"),
            is_active=True,
        )
        get_or_create_vehicle(
            db,
            plate_number="CNA 78GH",
            organization_id=budlift.id,
            name="Transport Budlift — naczepa",
            max_weight_tons=Decimal("25.00"),
            is_active=True,
        )

        db.commit()
        print("Sukces! Seed: Kujawy Maszyny, TerraRent Bydgoszcz, Budlift Białe Błota.")
    except Exception as e:
        db.rollback()
        print(f"Błąd podczas zasilania bazy: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()