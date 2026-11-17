import math
from fastapi.responses import Response
from app.pdf_generator import generate_booking_pdf
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from app.database import SessionLocal
from app.models import (
    User, UserRole, Machine, OperatorProfile, TransportVehicle,
    OperatorQualification, Booking, BookingStatus,
    UnavailabilityBlock, HandoverProtocol, Qualification
)
from app.schemas import (
    BookingCreate, BookingResponse, BookingQuoteResponse, BookingStatusUpdate,
    HandoverCreate, BlockCreate, LoginRequest, MachineCreate, TokenResponse, RegisterRequest
)
from app.auth import verify_password, create_access_token, get_current_user, hash_password

app = FastAPI(
    title="Digvo API",
    description="System rezerwacji sprzętu budowlanego, operatorów i logistyki transportu",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        

AVG_TRANSPORT_SPEED_KMH = 45.0
TRANSPORT_LOAD_HOURS = 0.5
DEFAULT_TRANSPORT_BUFFER_HOURS = 1.0


def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    straight_km = 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(straight_km * 1.25, 1)


def estimate_transport_buffer_hours(distance_km: float | None) -> float:
    if distance_km is None or distance_km <= 0:
        return DEFAULT_TRANSPORT_BUFFER_HOURS
    hours = (distance_km / AVG_TRANSPORT_SPEED_KMH) + TRANSPORT_LOAD_HOURS
    return round(max(DEFAULT_TRANSPORT_BUFFER_HOURS, hours), 2)


def resolve_delivery_distance_km(org, payload: BookingCreate) -> float | None:
    if not payload.with_transport:
        return None
    if payload.delivery_lat is None or payload.delivery_lng is None:
        return None
    if not org or org.base_lat is None or org.base_lng is None:
        return None
    return calculate_distance_km(
        float(org.base_lat),
        float(org.base_lng),
        float(payload.delivery_lat),
        float(payload.delivery_lng),
    )


def _week_window(start_time: datetime) -> tuple[datetime, datetime]:
    local = start_time
    week_start = (local - timedelta(days=local.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return week_start, week_start + timedelta(days=7)


def operator_week_load_hours(
    db: Session, operator_id, start_time: datetime
) -> float:
    week_start, week_end = _week_window(start_time)
    bookings = db.execute(
        select(Booking).where(
            Booking.operator_id == operator_id,
            Booking.status != BookingStatus.CANCELLED,
            Booking.start_time < week_end,
            Booking.end_time > week_start,
        )
    ).scalars().all()
    total = 0.0
    for b in bookings:
        total += (b.end_time - b.start_time).total_seconds() / 3600.0
    return round(total, 2)


def score_operator(
    db: Session,
    op: OperatorProfile,
    machine: Machine,
    start_time: datetime,
    end_time: datetime,
) -> float:
    """
    Wyższa punktacja = lepszy wybór.
    - mniej godzin w tygodniu (balans obciążenia)
    - dłuższa ważność uprawnienia do tej maszyny
    - lekko niższa stawka godzinowa
    """
    load_h = operator_week_load_hours(db, op.user_id, start_time)
    load_score = max(0.0, 40.0 - load_h)

    qual = db.execute(
        select(OperatorQualification).where(
            OperatorQualification.operator_id == op.user_id,
            OperatorQualification.qualification_id == machine.required_qualification_id,
        )
    ).scalars().first()
    days_left = 0
    if qual and qual.valid_until:
        days_left = max(0, (qual.valid_until - end_time.date()).days)
    qual_score = min(30.0, days_left / 30.0)  # max 30 pkt (~2.5 roku)

    rate = float(op.hourly_rate_net)
    rate_score = max(0.0, 30.0 - (rate / 5.0))  # tańszy lekko wyżej

    return round(load_score + qual_score + rate_score, 2)


def find_available_operator(
    db: Session, machine: Machine, start_time: datetime, end_time: datetime
) -> OperatorProfile | None:
    qualified_ops = db.execute(
        select(OperatorProfile)
        .join(OperatorQualification)
        .where(
            OperatorProfile.organization_id == machine.organization_id,
            OperatorProfile.is_active == True,
            OperatorQualification.qualification_id == machine.required_qualification_id,
            OperatorQualification.valid_until >= end_time.date(),
        )
    ).scalars().all()

    best: OperatorProfile | None = None
    best_score = -1.0

    for op in qualified_ops:
        op_busy = db.execute(
            select(Booking).where(
                Booking.operator_id == op.user_id,
                Booking.status != BookingStatus.CANCELLED,
                Booking.start_time < end_time,
                Booking.end_time > start_time,
            ).limit(1)
        ).scalars().first()

        op_blocked = db.execute(
            select(UnavailabilityBlock).where(
                UnavailabilityBlock.operator_id == op.user_id,
                UnavailabilityBlock.start_time < end_time,
                UnavailabilityBlock.end_time > start_time,
            ).limit(1)
        ).scalars().first()

        if op_busy or op_blocked:
            continue

        score = score_operator(db, op, machine, start_time, end_time)
        if score > best_score:
            best_score = score
            best = op

    return best


def find_available_transport(
    db: Session,
    machine: Machine,
    start_time: datetime,
    end_time: datetime,
    transport_buffer: timedelta | None = None,
) -> TransportVehicle | None:
    buffer = transport_buffer or timedelta(0)
    window_start = start_time - buffer
    window_end = end_time + buffer

    vehicles = db.execute(
        select(TransportVehicle).where(
            TransportVehicle.organization_id == machine.organization_id,
            TransportVehicle.is_active == True,
        )
    ).scalars().all()

    for vehicle in vehicles:
        busy = db.execute(
            select(Booking).where(
                Booking.transport_vehicle_id == vehicle.id,
                Booking.status != BookingStatus.CANCELLED,
                Booking.start_time < window_end,
                Booking.end_time > window_start,
            ).limit(1)
        ).scalars().first()
        if not busy:
            return vehicle
    return None


@app.get("/")
def health_check():
    return {"status": "ok", "service": "Digvo Backend API v1.0 (JWT Protected)"}


@app.get("/fx/eur")
def get_eur_rate():
    """Kurs EUR/PLN z NBP (tabela A) — do wielowalutowości marketplace."""
    import json
    from urllib.request import urlopen, Request

    try:
        req = Request(
            "https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json",
            headers={"Accept": "application/json", "User-Agent": "Digvo/1.0"},
        )
        with urlopen(req, timeout=8) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        rate = float(payload["rates"][0]["mid"])
        return {
            "currency": "EUR",
            "rate": rate,
            "date": payload["rates"][0]["effectiveDate"],
            "source": "NBP",
        }
    except Exception:
        # fallback, żeby UI nie padał przy awarii NBP
        return {"currency": "EUR", "rate": 4.25, "date": None, "source": "fallback"}


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy adres e-mail lub hasło."
        )

    token = create_access_token(user.id, user.role.value)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        full_name=user.full_name,
        role=user.role.value
    )
    

@app.post("/auth/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Konto z tym adresem e-mail już istnieje.")

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        phone=payload.phone.strip(),
        role=UserRole.CLIENT,
        organization_id=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.role.value)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        full_name=user.full_name,
        role=user.role.value,
    )


@app.get("/machines")
def list_machines(db: Session = Depends(get_db)):
    machines = db.execute(
        select(Machine).options(joinedload(Machine.organization))
    ).scalars().unique().all()
    return [
        {
            "id": str(m.id),
            "organization_id": str(m.organization_id),
            "organization_name": m.organization.name if m.organization else None,
            "base_lat": float(m.organization.base_lat) if m.organization and m.organization.base_lat is not None else None,
            "base_lng": float(m.organization.base_lng) if m.organization and m.organization.base_lng is not None else None,
            "name": m.name,
            "category": m.category,
            "daily_rate_net": float(m.daily_rate_net),
            "deposit_amount": float(m.deposit_amount),
            "transport_rate_per_km": float(m.transport_rate_per_km),
            "service_buffer_hours": m.service_buffer_hours,
        }
        for m in machines
    ]
    

@app.post("/bookings/quote", response_model=BookingQuoteResponse)
def quote_booking(payload: BookingCreate, db: Session = Depends(get_db)):
    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=400, detail="Data zakończenia musi być późniejsza niż rozpoczęcia.")

    machine = db.execute(
        select(Machine)
        .options(joinedload(Machine.organization))
        .where(Machine.id == payload.machine_id)
    ).scalars().first()
    if not machine:
        raise HTTPException(status_code=404, detail="Nie znaleziono maszyny.")

    unavailable_reason = None

    if machine.udt_valid_until and machine.udt_valid_until < payload.end_time.date():
        unavailable_reason = f"Maszyna ma nieważny przegląd UDT (ważny do {machine.udt_valid_until.isoformat()})."

    buffer = timedelta(hours=machine.service_buffer_hours)
    if not unavailable_reason:
        machine_block = db.execute(
            select(UnavailabilityBlock).where(
                UnavailabilityBlock.machine_id == payload.machine_id,
                UnavailabilityBlock.start_time < payload.end_time + buffer,
                UnavailabilityBlock.end_time > payload.start_time,
            ).limit(1)
        ).scalars().first()
        if machine_block:
            unavailable_reason = f"Maszyna jest zablokowana serwisowo ({machine_block.reason.value}) w tym terminie."

    if not unavailable_reason:
        buffered_conflict = db.execute(
            select(Booking).where(
                Booking.machine_id == machine.id,
                Booking.status != BookingStatus.CANCELLED,
                Booking.start_time < payload.end_time + buffer,
                Booking.end_time > payload.start_time - buffer,
            ).limit(1)
        ).scalars().first()
        if buffered_conflict:
            unavailable_reason = f"Maszyna niedostępna — wymagany bufor serwisowy {machine.service_buffer_hours} h."

    org = machine.organization
    distance_km = resolve_delivery_distance_km(org, payload)
    transport_buffer_hours = (
        estimate_transport_buffer_hours(distance_km) if payload.with_transport else None
    )
    transport_buffer = (
        timedelta(hours=transport_buffer_hours) if transport_buffer_hours is not None else None
    )

    assigned_op = None
    if payload.with_operator and not unavailable_reason:
        assigned_op = find_available_operator(db, machine, payload.start_time, payload.end_time)
        if not assigned_op:
            unavailable_reason = "Brak wolnego operatora z wymaganymi uprawnieniami UDT w tym terminie."

    if payload.with_transport and not unavailable_reason:
        assigned_vehicle = find_available_transport(
            db, machine, payload.start_time, payload.end_time, transport_buffer
        )
        if not assigned_vehicle:
            unavailable_reason = (
                "Brak wolnego pojazdu transportowego u tego dostawcy w wybranym terminie "
                f"(wraz z buforem logistycznym {transport_buffer_hours} h)."
            )

    total_hours = Decimal(str((payload.end_time - payload.start_time).total_seconds() / 3600))
    rental_days = max(Decimal("1"), Decimal(str(math.ceil(float(total_hours) / 24))))
    machine_cost = (rental_days * machine.daily_rate_net).quantize(Decimal("0.01"))

    operator_rate = assigned_op.hourly_rate_net if assigned_op else Decimal("0.00")
    if payload.with_operator and assigned_op is None:
        preview_op = db.execute(
            select(OperatorProfile).where(
                OperatorProfile.organization_id == machine.organization_id,
                OperatorProfile.is_active == True,
            ).limit(1)
        ).scalars().first()
        if preview_op:
            operator_rate = preview_op.hourly_rate_net

    operator_cost = (total_hours * operator_rate).quantize(Decimal("0.01")) if payload.with_operator else Decimal("0.00")

    transport_cost = Decimal("0.00")
    if distance_km is not None:
        transport_cost = (Decimal(str(distance_km * 2)) * machine.transport_rate_per_km).quantize(Decimal("0.01"))

    total_net = (machine_cost + operator_cost + transport_cost).quantize(Decimal("0.01"))
    total_gross = (total_net * Decimal("1.23")).quantize(Decimal("0.01"))

    assigned_operator_name = None
    operator_selection_score = None
    operator_week_load = None
    if assigned_op is not None:
        op_user = db.get(User, assigned_op.user_id)
        assigned_operator_name = op_user.full_name if op_user else None
        operator_selection_score = score_operator(
            db, assigned_op, machine, payload.start_time, payload.end_time
        )
        operator_week_load = operator_week_load_hours(
            db, assigned_op.user_id, payload.start_time
        )

    return BookingQuoteResponse(
        hours=float(total_hours),
        days=int(rental_days),
        machine_cost=machine_cost,
        operator_cost=operator_cost,
        operator_hourly_rate=operator_rate if payload.with_operator else None,
        transport_cost=transport_cost,
        distance_km_one_way=distance_km,
        transport_buffer_hours=transport_buffer_hours,
        total_net=total_net,
        total_gross=total_gross,
        deposit_amount=machine.deposit_amount,
        available=unavailable_reason is None,
        unavailable_reason=unavailable_reason,
        assigned_operator_name=assigned_operator_name,
        operator_selection_score=operator_selection_score,
        operator_week_load_hours=operator_week_load,
    )


@app.post("/bookings", response_model=BookingResponse, status_code=201)
def create_booking(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=400, detail="Data zakończenia musi być późniejsza niż rozpoczęcia.")

    machine = db.execute(
        select(Machine)
        .options(joinedload(Machine.organization))
        .where(Machine.id == payload.machine_id)
    ).scalars().first()
    if not machine:
        raise HTTPException(status_code=404, detail="Nie znaleziono maszyny.")

    if machine.udt_valid_until and machine.udt_valid_until < payload.end_time.date():
        raise HTTPException(
            status_code=409,
            detail=f"Maszyna ma nieważny przegląd UDT (ważny do {machine.udt_valid_until.isoformat()})."
        )

    buffer = timedelta(hours=machine.service_buffer_hours)
    effective_end = payload.end_time + buffer

    machine_block = db.execute(
        select(UnavailabilityBlock).where(
            UnavailabilityBlock.machine_id == payload.machine_id,
            UnavailabilityBlock.start_time < effective_end,
            UnavailabilityBlock.end_time > payload.start_time
        ).limit(1)
    ).scalars().first()

    if machine_block:
        raise HTTPException(
            status_code=409,
            detail=f"Maszyna jest zablokowana serwisowo ({machine_block.reason.value}) w tym terminie."
        )

    buffered_conflict = db.execute(
        select(Booking).where(
            Booking.machine_id == machine.id,
            Booking.status != BookingStatus.CANCELLED,
            Booking.start_time < payload.end_time + buffer,
            Booking.end_time > payload.start_time - buffer,
        ).limit(1)
    ).scalars().first()
    if buffered_conflict:
        raise HTTPException(
            status_code=409,
            detail=f"Maszyna niedostępna — wymagany bufor serwisowy {machine.service_buffer_hours} h po poprzednim zleceniu."
        )

    org = machine.organization
    distance_km = resolve_delivery_distance_km(org, payload)
    transport_buffer_hours = (
        estimate_transport_buffer_hours(distance_km) if payload.with_transport else None
    )
    transport_buffer = (
        timedelta(hours=transport_buffer_hours) if transport_buffer_hours is not None else None
    )

    assigned_op = None
    if payload.with_operator:
        assigned_op = find_available_operator(db, machine, payload.start_time, payload.end_time)
        if not assigned_op:
            raise HTTPException(status_code=409, detail="Brak wolnego operatora z wymaganymi uprawnieniami UDT w tym terminie.")

    assigned_vehicle = None
    if payload.with_transport:
        assigned_vehicle = find_available_transport(
            db, machine, payload.start_time, payload.end_time, transport_buffer
        )
        if not assigned_vehicle:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Brak wolnego pojazdu transportowego u tego dostawcy w wybranym terminie "
                    f"(wraz z buforem logistycznym {transport_buffer_hours} h)."
                ),
            )

    total_hours = Decimal(str((payload.end_time - payload.start_time).total_seconds() / 3600))
    rental_days = max(Decimal("1"), Decimal(str(math.ceil(float(total_hours) / 24))))

    machine_cost = rental_days * machine.daily_rate_net
    operator_cost = (total_hours * assigned_op.hourly_rate_net) if assigned_op else Decimal("0.00")

    transport_cost = Decimal("0.00")
    if distance_km is not None:
        transport_cost = Decimal(str(distance_km * 2)) * machine.transport_rate_per_km

    total_price = (machine_cost + operator_cost + transport_cost).quantize(Decimal("0.01"))

    new_booking = Booking(
        client_id=current_user.id,
        machine_id=machine.id,
        operator_id=assigned_op.user_id if assigned_op else None,
        transport_vehicle_id=assigned_vehicle.id if assigned_vehicle else None,
        start_time=payload.start_time,
        end_time=payload.end_time,
        with_operator=payload.with_operator,
        with_transport=payload.with_transport,
        delivery_address=payload.delivery_address,
        delivery_lat=payload.delivery_lat,
        delivery_lng=payload.delivery_lng,
        total_price_net=total_price,
        deposit_paid=Decimal("0.00"),
        has_damage_waiver=payload.has_damage_waiver,
        status=BookingStatus.CONFIRMED
    )

    try:
        db.add(new_booking)
        db.commit()
        db.refresh(new_booking)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Konflikt terminów! Maszyna, operator lub transport zostali właśnie zarezerwowani.",
        )

    return BookingResponse(
        id=new_booking.id,
        machine_id=new_booking.machine_id,
        operator_id=new_booking.operator_id,
        start_time=new_booking.start_time,
        end_time=new_booking.end_time,
        with_operator=new_booking.with_operator,
        with_transport=new_booking.with_transport,
        delivery_address=new_booking.delivery_address,
        total_price_net=new_booking.total_price_net,
        deposit_amount=machine.deposit_amount,
        status=new_booking.status.value
    )

@app.get("/bookings")
def list_bookings(db: Session = Depends(get_db)):
    bookings = db.execute(
        select(Booking).order_by(Booking.start_time.desc())
    ).scalars().all()

    users_map = {u.id: u.full_name for u in db.execute(select(User)).scalars().all()}

    result = []
    for b in bookings:
        protocols = db.execute(
            select(HandoverProtocol).where(HandoverProtocol.booking_id == b.id)
        ).scalars().all()
        result.append({
            "id": str(b.id),
            "client_id": str(b.client_id),
            "machine_id": str(b.machine_id),
            "operator_id": str(b.operator_id) if b.operator_id else None,
            "operator_name": users_map.get(b.operator_id) if b.operator_id else None,
            "start_time": b.start_time,
            "end_time": b.end_time,
            "delivery_address": b.delivery_address,
            "total_price_net": float(b.total_price_net),
            "status": b.status.value,
            "protocols": [
                {
                    "protocol_type": p.protocol_type,
                    "engine_hours_reading": float(p.engine_hours_reading),
                    "created_at": p.created_at,
                }
                for p in protocols
            ],
        })
    return result


@app.patch("/bookings/{booking_id}/status")
def update_booking_status(
    booking_id: UUID,
    payload: BookingStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in (UserRole.DISPATCHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Tylko dyspozytor może zmieniać status zlecenia.")

    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Nie znaleziono rezerwacji.")

    booking.status = payload.status
    db.commit()
    db.refresh(booking)
    return {"id": str(booking.id), "status": booking.status.value}


@app.post("/bookings/{booking_id}/handover", status_code=201)
def create_handover_protocol(
    booking_id: UUID,
    payload: HandoverCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in (UserRole.OPERATOR, UserRole.DISPATCHER):
        raise HTTPException(status_code=403, detail="Brak uprawnień do sporządzania protokołu.")

    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Nie znaleziono rezerwacji.")

    existing = db.execute(
        select(HandoverProtocol).where(
            HandoverProtocol.booking_id == booking_id,
            HandoverProtocol.protocol_type == payload.protocol_type
        )
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=409, detail=f"Protokół typu {payload.protocol_type} został już sporządzony.")

    if payload.protocol_type == "RETURN":
        pickup = db.execute(
            select(HandoverProtocol).where(
                HandoverProtocol.booking_id == booking_id,
                HandoverProtocol.protocol_type == "PICKUP"
            )
        ).scalar_one_or_none()
        if not pickup:
            raise HTTPException(
                status_code=400,
                detail="Najpierw należy sporządzić protokół wydania (PICKUP)."
            )
        if payload.engine_hours_reading < pickup.engine_hours_reading:
            raise HTTPException(
                status_code=400,
                detail=f"Stan licznika przy zwrocie ({payload.engine_hours_reading} mth) nie może być niższy niż przy wydaniu ({pickup.engine_hours_reading} mth)."
            )
        
    protocol = HandoverProtocol(
        booking_id=booking_id,
        protocol_type=payload.protocol_type,
        engine_hours_reading=payload.engine_hours_reading,
        photos_urls={"notes": payload.notes} if payload.notes else {}
    )
    db.add(protocol)

    if payload.protocol_type == "PICKUP" and booking.status == BookingStatus.CONFIRMED:
        booking.status = BookingStatus.IN_PROGRESS
    elif payload.protocol_type == "RETURN" and booking.status in (BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS):
        booking.status = BookingStatus.COMPLETED

    db.commit()
    return {
        "message": f"Zapisano protokół {payload.protocol_type} ({payload.engine_hours_reading} mth).",
        "booking_status": booking.status.value
    }


@app.get("/blocks")
def list_blocks(db: Session = Depends(get_db)):
    blocks = db.execute(select(UnavailabilityBlock).order_by(UnavailabilityBlock.start_time.asc())).scalars().all()
    return [
        {
            "id": str(bl.id),
            "machine_id": str(bl.machine_id) if bl.machine_id else None,
            "start_time": bl.start_time.isoformat(),
            "end_time": bl.end_time.isoformat(),
            "reason": bl.reason.value
        }
        for bl in blocks
    ]


@app.post("/blocks", status_code=201)
def create_block(
    payload: BlockCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in (UserRole.DISPATCHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Tylko dyspozytor może zakładać blokady serwisowe.")

    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=400, detail="Data zakończenia blokady musi być późniejsza niż rozpoczęcia.")

    machine = db.get(Machine, payload.machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Nie znaleziono maszyny.")

    block = UnavailabilityBlock(
        machine_id=payload.machine_id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        reason=payload.reason
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return {"id": str(block.id), "message": f"Dodano blokadę serwisową ({block.reason.value}) dla {machine.name}."}

@app.get("/bookings/{booking_id}/pdf")
def download_booking_pdf(booking_id: UUID, db: Session = Depends(get_db)):
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Nie znaleziono rezerwacji.")

    machine = db.get(Machine, booking.machine_id)
    client = db.get(User, booking.client_id)
    operator = db.get(User, booking.operator_id) if booking.operator_id else None
    protocols = db.execute(
        select(HandoverProtocol).where(HandoverProtocol.booking_id == booking_id)
    ).scalars().all()

    pdf_bytes = generate_booking_pdf(booking, machine, client, operator, list(protocols))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=digvo_protokol_{str(booking.id)[:8]}.pdf"}
    )

@app.delete("/blocks/{block_id}")
def delete_block(
    block_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in (UserRole.DISPATCHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Tylko dyspozytor może usuwać blokady serwisowe.")

    block = db.get(UnavailabilityBlock, block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Nie znaleziono blokady.")

    db.delete(block)
    db.commit()
    return {"message": "Blokada serwisowa została usunięta."}


@app.get("/bookings/my")
def list_my_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    bookings = db.execute(
        select(Booking)
        .where(Booking.client_id == current_user.id)
        .order_by(Booking.start_time.desc())
    ).scalars().all()

    users_map = {u.id: u.full_name for u in db.execute(select(User)).scalars().all()}

    result = []
    for b in bookings:
        protocols = db.execute(
            select(HandoverProtocol).where(HandoverProtocol.booking_id == b.id)
        ).scalars().all()
        result.append({
            "id": str(b.id),
            "client_id": str(b.client_id),
            "machine_id": str(b.machine_id),
            "operator_id": str(b.operator_id) if b.operator_id else None,
            "operator_name": users_map.get(b.operator_id) if b.operator_id else None,
            "start_time": b.start_time,
            "end_time": b.end_time,
            "delivery_address": b.delivery_address,
            "total_price_net": float(b.total_price_net),
            "status": b.status.value,
            "protocols": [
                {
                    "protocol_type": p.protocol_type,
                    "engine_hours_reading": float(p.engine_hours_reading),
                    "created_at": p.created_at,
                }
                for p in protocols
            ],
        })
    return result

@app.post("/machines")
def create_machine(
    payload: MachineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in (UserRole.DISPATCHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Tylko dyspozytor może dodawać maszyny do floty.")

    qual = db.execute(select(Qualification)).scalars().first()
    qual_id = qual.id if qual else 1

    machine = Machine(
        organization_id=current_user.organization_id,
        required_qualification_id=qual_id,
        name=payload.name,
        category=payload.category,
        daily_rate_net=payload.daily_rate_net,
        deposit_amount=payload.deposit_amount,
        transport_rate_per_km=payload.transport_rate_per_km,
        service_buffer_hours=payload.service_buffer_hours,
    )
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return {
        "id": str(machine.id),
        "name": machine.name,
        "message": f"Dodano maszynę {machine.name} do katalogu floty."
    }