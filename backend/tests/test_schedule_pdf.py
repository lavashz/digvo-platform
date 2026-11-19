from datetime import date, datetime, timezone
from decimal import Decimal

from app.models import Booking, Machine


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


def test_schedule_move_happy_path(client_api, dispatcher_api, collision_world):
    machine_id = collision_world["machine"].id
    start = datetime(2031, 4, 10, 8, 0, tzinfo=timezone.utc)
    end = datetime(2031, 4, 10, 16, 0, tzinfo=timezone.utc)

    created = client_api.post("/bookings", json=_payload(machine_id, start, end, with_operator=True))
    assert created.status_code == 201, created.text
    booking_id = created.json()["id"]

    new_start = datetime(2031, 4, 11, 9, 0, tzinfo=timezone.utc)
    new_end = datetime(2031, 4, 11, 17, 0, tzinfo=timezone.utc)
    moved = dispatcher_api.patch(
        f"/bookings/{booking_id}/schedule",
        json={
            "start_time": new_start.isoformat(),
            "end_time": new_end.isoformat(),
            "machine_id": str(machine_id),
        },
    )
    assert moved.status_code == 200, moved.text
    body = moved.json()
    assert body["id"] == booking_id
    assert "2031-04-11" in body["start_time"]


def test_schedule_collision_rejected(client_api, dispatcher_api, collision_world):
    machine_id = collision_world["machine"].id
    day_a = datetime(2031, 4, 12, 8, 0, tzinfo=timezone.utc)
    day_a_end = datetime(2031, 4, 12, 16, 0, tzinfo=timezone.utc)
    day_b = datetime(2031, 4, 13, 8, 0, tzinfo=timezone.utc)
    day_b_end = datetime(2031, 4, 13, 16, 0, tzinfo=timezone.utc)

    a = client_api.post("/bookings", json=_payload(machine_id, day_a, day_a_end))
    b = client_api.post("/bookings", json=_payload(machine_id, day_b, day_b_end))
    assert a.status_code == 201, a.text
    assert b.status_code == 201, b.text

    conflict = dispatcher_api.patch(
        f"/bookings/{b.json()['id']}/schedule",
        json={
            "start_time": day_a.isoformat(),
            "end_time": day_a_end.isoformat(),
            "machine_id": str(machine_id),
        },
    )
    assert conflict.status_code == 409, conflict.text
    detail = conflict.json()["detail"].lower()
    assert "bufor" in detail or "niedostępna" in detail or "konflikt" in detail


def test_schedule_to_other_machine(client_api, dispatcher_api, db, collision_world):
    org = collision_world["org"]
    qual = collision_world["qual"]
    suffix = collision_world["suffix"]

    machine2 = Machine(
        organization_id=org.id,
        required_qualification_id=qual.id,
        name=f"Test Schedule Target {suffix}",
        category="Koparki gąsienicowe",
        daily_rate_net=Decimal("800.00"),
        deposit_amount=Decimal("1000.00"),
        transport_rate_per_km=Decimal("10.00"),
        service_buffer_hours=2,
        udt_valid_until=date(2035, 6, 1),
    )
    db.add(machine2)
    db.commit()
    db.refresh(machine2)

    start = datetime(2031, 4, 14, 8, 0, tzinfo=timezone.utc)
    end = datetime(2031, 4, 14, 16, 0, tzinfo=timezone.utc)
    created = client_api.post(
        "/bookings",
        json=_payload(collision_world["machine"].id, start, end, with_operator=True),
    )
    assert created.status_code == 201, created.text
    booking_id = created.json()["id"]

    moved = dispatcher_api.patch(
        f"/bookings/{booking_id}/schedule",
        json={
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "machine_id": str(machine2.id),
        },
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["machine_id"] == str(machine2.id)

    db.query(Booking).filter(Booking.machine_id == machine2.id).delete(synchronize_session=False)
    db.query(Machine).filter(Machine.id == machine2.id).delete(synchronize_session=False)
    db.commit()


def test_pdf_generated_for_booking(client_api, collision_world):
    start = datetime(2031, 4, 15, 8, 0, tzinfo=timezone.utc)
    end = datetime(2031, 4, 15, 16, 0, tzinfo=timezone.utc)
    created = client_api.post(
        "/bookings",
        json=_payload(collision_world["machine"].id, start, end, with_operator=True),
    )
    assert created.status_code == 201, created.text
    booking_id = created.json()["id"]

    pdf = client_api.get(f"/bookings/{booking_id}/pdf")
    assert pdf.status_code == 200, pdf.text
    assert pdf.headers["content-type"].startswith("application/pdf")
    assert pdf.content[:4] == b"%PDF"
    assert len(pdf.content) > 500