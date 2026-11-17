import os
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ważne: testy muszą widzieć ten sam DATABASE_URL co seed (Neon)
os.environ.setdefault(
    "DATABASE_URL",
    os.getenv("DATABASE_URL", "postgresql+psycopg://digvo_user:digvo_secret_password@localhost:5432/digvo_db"),
)

from app.database import DATABASE_URL
from app.main import app, get_db
from app.auth import get_current_user
from app.models import (
    Base,
    Organization,
    User,
    UserRole,
    Qualification,
    Machine,
    OperatorProfile,
    OperatorQualification,
    TransportVehicle,
    Booking,
)


engine = create_engine(DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db():
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def collision_world(db):
    """Izolowany mini-świat: 1 dostawca, 1 maszyna, 1 operator, 1 laweta, 1 klient."""
    suffix = uuid.uuid4().hex[:8]
    tax_id = f"9{suffix[:9]}"

    org = Organization(
        name=f"Test Fleet {suffix}",
        tax_id=tax_id,
        is_vendor=True,
        base_lat=Decimal("53.123480"),
        base_lng=Decimal("18.008438"),
        oc_valid_until=date(2030, 1, 1),
    )
    db.add(org)
    db.flush()

    qual = db.query(Qualification).filter_by(code="KOP-JED-I").first()
    if not qual:
        qual = Qualification(code="KOP-JED-I", name="Koparki jednonaczyniowe kl. I")
        db.add(qual)
        db.flush()

    machine = Machine(
        organization_id=org.id,
        required_qualification_id=qual.id,
        name=f"Test CAT {suffix}",
        category="Koparki gąsienicowe",
        daily_rate_net=Decimal("1000.00"),
        deposit_amount=Decimal("2000.00"),
        transport_rate_per_km=Decimal("10.00"),
        service_buffer_hours=4,
        udt_valid_until=date(2035, 6, 1),
    )
    db.add(machine)

    client = User(
        email=f"client-{suffix}@test.digvo.local",
        password_hash="hashed_secret_123",
        full_name="Test Client",
        phone="+48 500 000 001",
        role=UserRole.CLIENT,
    )
    operator_user = User(
        email=f"op-{suffix}@test.digvo.local",
        organization_id=org.id,
        password_hash="hashed_secret_123",
        full_name="Test Operator",
        phone="+48 500 000 002",
        role=UserRole.OPERATOR,
    )
    db.add_all([client, operator_user])
    db.flush()

    op = OperatorProfile(
        user_id=operator_user.id,
        organization_id=org.id,
        hourly_rate_net=Decimal("65.00"),
        is_active=True,
    )
    db.add(op)
    db.flush()
    db.add(
        OperatorQualification(
            operator_id=operator_user.id,
            qualification_id=qual.id,
            valid_until=date(2035, 12, 31),
        )
    )

    vehicle = TransportVehicle(
        organization_id=org.id,
        name=f"Test Laweta {suffix}",
        plate_number=f"TST{suffix[:5].upper()}",
        max_weight_tons=Decimal("30.00"),
        is_active=True,
    )
    db.add(vehicle)
    db.commit()

    world = {
        "org": org,
        "machine": machine,
        "client": client,
        "operator_user": operator_user,
        "vehicle": vehicle,
        "qual": qual,
        "suffix": suffix,
    }
    yield world

    # sprzątanie (kolejność przez FK)
    db.query(Booking).filter(
        (Booking.machine_id == machine.id) | (Booking.client_id == client.id)
    ).delete(synchronize_session=False)
    db.query(TransportVehicle).filter(TransportVehicle.id == vehicle.id).delete(synchronize_session=False)
    db.query(OperatorQualification).filter(
        OperatorQualification.operator_id == operator_user.id
    ).delete(synchronize_session=False)
    db.query(OperatorProfile).filter(OperatorProfile.user_id == operator_user.id).delete(synchronize_session=False)
    db.query(Machine).filter(Machine.organization_id == org.id).delete(synchronize_session=False)
    db.query(User).filter(User.id.in_([client.id, operator_user.id])).delete(synchronize_session=False)
    db.query(Organization).filter(Organization.id == org.id).delete(synchronize_session=False)
    db.commit()


@pytest.fixture()
def client_api(db, collision_world):
    def _override_get_db():
        try:
            yield db
        finally:
            pass

    def _override_user():
        return collision_world["client"]

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def slot(day_offset: int = 30, hour_start: int = 8, hour_end: int = 16):
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=day_offset, hours=hour_start)
    end = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=day_offset, hours=hour_end)
    return start, end