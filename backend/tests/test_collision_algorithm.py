from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.models import Machine, Booking, BookingStatus


def _payload(machine_id, start, end, with_operator=False, with_transport=False):
    return {
        "machine_id": str(machine_id),
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "with_operator": with_operator,
        "with_transport": with_transport,
        "delivery_address": "ul. Fordońska 40, Bydgoszcz" if with_transport else None,
        "delivery_lat": "53.126000" if with_transport else None,
        "delivery_lng": "18.045000" if with_transport else None,
        "has_damage_waiver": False,
    }


def test_happy_path_booking(client_api, collision_world):
    start = datetime(2031, 3, 10, 8, 0, tzinfo=timezone.utc)
    end = datetime(2031, 3, 10, 16, 0, tzinfo=timezone.utc)
    res = client_api.post(
        "/bookings",
        json=_payload(collision_world["machine"].id, start, end, with_operator=True, with_transport=True),
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["with_operator"] is True
    assert body["with_transport"] is True
    assert body["operator_id"] is not None


def test_same_machine_overlap_rejected(client_api, collision_world):
    start = datetime(2031, 3, 11, 8, 0, tzinfo=timezone.utc)
    end = datetime(2031, 3, 11, 16, 0, tzinfo=timezone.utc)
    machine_id = collision_world["machine"].id

    first = client_api.post("/bookings", json=_payload(machine_id, start, end))
    assert first.status_code == 201, first.text

    second = client_api.post("/bookings", json=_payload(machine_id, start, end))
    assert second.status_code == 409, second.text
    assert "bufor" in second.json()["detail"].lower() or "konflikt" in second.json()["detail"].lower() or "niedostępna" in second.json()["detail"].lower()


def test_service_buffer_blocks_adjacent_booking(client_api, collision_world):
    """Bufor 4h: po 08–16 kolejna od 17:00 ma spaść."""
    machine_id = collision_world["machine"].id
    day = datetime(2031, 3, 12, tzinfo=timezone.utc)

    first = client_api.post(
        "/bookings",
        json=_payload(machine_id, day.replace(hour=8), day.replace(hour=16)),
    )
    assert first.status_code == 201, first.text

    too_soon = client_api.post(
        "/bookings",
        json=_payload(machine_id, day.replace(hour=17), day.replace(hour=20)),
    )
    assert too_soon.status_code == 409, too_soon.text
    assert "bufor" in too_soon.json()["detail"].lower()


def test_operator_busy_on_second_machine(client_api, db, collision_world):
    """Jeden operator, dwie maszyny, ten sam termin → druga bez wolnego operatora."""
    org = collision_world["org"]
    qual = collision_world["qual"]
    suffix = collision_world["suffix"]

    machine2 = Machine(
        organization_id=org.id,
        required_qualification_id=qual.id,
        name=f"Test Machine B {suffix}",
        category="Koparki gąsienicowe",
        daily_rate_net=Decimal("900.00"),
        deposit_amount=Decimal("1500.00"),
        transport_rate_per_km=Decimal("10.00"),
        service_buffer_hours=2,
        udt_valid_until=date(2035, 6, 1),
    )
    db.add(machine2)
    db.commit()
    db.refresh(machine2)

    start = datetime(2031, 3, 13, 8, 0, tzinfo=timezone.utc)
    end = datetime(2031, 3, 13, 16, 0, tzinfo=timezone.utc)

    first = client_api.post(
        "/bookings",
        json=_payload(collision_world["machine"].id, start, end, with_operator=True),
    )
    assert first.status_code == 201, first.text

    second = client_api.post(
        "/bookings",
        json=_payload(machine2.id, start, end, with_operator=True),
    )
    assert second.status_code == 409, second.text
    assert "operatora" in second.json()["detail"].lower()

    db.query(Booking).filter(Booking.machine_id == machine2.id).delete(synchronize_session=False)
    db.query(Machine).filter(Machine.id == machine2.id).delete(synchronize_session=False)
    db.commit()


def test_transport_limit_one_vehicle(client_api, db, collision_world):
    """Jedna laweta: druga rezerwacja z transportem w tym samym czasie → 409."""
    org = collision_world["org"]
    qual = collision_world["qual"]
    suffix = collision_world["suffix"]

    machine2 = Machine(
        organization_id=org.id,
        required_qualification_id=qual.id,
        name=f"Test Machine Transport {suffix}",
        category="Minikoparki",
        daily_rate_net=Decimal("400.00"),
        deposit_amount=Decimal("800.00"),
        transport_rate_per_km=Decimal("6.00"),
        service_buffer_hours=2,
        udt_valid_until=date(2035, 6, 1),
    )
    db.add(machine2)
    db.commit()
    db.refresh(machine2)

    start = datetime(2031, 3, 14, 8, 0, tzinfo=timezone.utc)
    end = datetime(2031, 3, 14, 16, 0, tzinfo=timezone.utc)

    first = client_api.post(
        "/bookings",
        json=_payload(collision_world["machine"].id, start, end, with_transport=True),
    )
    assert first.status_code == 201, first.text

    second = client_api.post(
        "/bookings",
        json=_payload(machine2.id, start, end, with_transport=True),
    )
    assert second.status_code == 409, second.text
    assert "pojazd" in second.json()["detail"].lower() or "transport" in second.json()["detail"].lower()

    db.query(Booking).filter(Booking.machine_id == machine2.id).delete(synchronize_session=False)
    db.query(Machine).filter(Machine.id == machine2.id).delete(synchronize_session=False)
    db.commit()


def test_expired_udt_rejected(client_api, db, collision_world):
    machine = collision_world["machine"]
    machine.udt_valid_until = date(2020, 1, 1)
    db.commit()

    start = datetime(2031, 3, 15, 8, 0, tzinfo=timezone.utc)
    end = datetime(2031, 3, 15, 16, 0, tzinfo=timezone.utc)
    res = client_api.post("/bookings", json=_payload(machine.id, start, end))
    assert res.status_code == 409, res.text
    assert "udt" in res.json()["detail"].lower()

    machine.udt_valid_until = date(2035, 6, 1)
    db.commit()