import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import (
    String, Boolean, Integer, Numeric, Date, DateTime,
    ForeignKey, Enum, func, text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class UserRole(str, enum.Enum):
    CLIENT = "CLIENT"
    DISPATCHER = "DISPATCHER"
    OPERATOR = "OPERATOR"
    ADMIN = "ADMIN"


class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class BlockReason(str, enum.Enum):
    VACATION = "VACATION"
    SICK_LEAVE = "SICK_LEAVE"
    MAINTENANCE = "MAINTENANCE"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tax_id: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    is_vendor: Mapped[bool] = mapped_column(Boolean, default=False)
    oc_policy_url: Mapped[str | None] = mapped_column(String(512))
    oc_valid_until: Mapped[date | None] = mapped_column(Date)
    base_lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    base_lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))

    users: Mapped[list["User"]] = relationship(back_populates="organization")
    machines: Mapped[list["Machine"]] = relationship(back_populates="organization")
    transport_vehicles: Mapped[list["TransportVehicle"]] = relationship(back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organizations.id"))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.CLIENT)

    organization: Mapped["Organization | None"] = relationship(back_populates="users")
    operator_profile: Mapped["OperatorProfile | None"] = relationship(back_populates="user", uselist=False)


class Qualification(Base):
    __tablename__ = "qualifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)


class Machine(Base):
    __tablename__ = "machines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    required_qualification_id: Mapped[int] = mapped_column(ForeignKey("qualifications.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    daily_rate_net: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    deposit_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    transport_rate_per_km: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    service_buffer_hours: Mapped[int] = mapped_column(Integer, default=4)
    udt_valid_until: Mapped[date | None] = mapped_column(Date)

    organization: Mapped["Organization"] = relationship(back_populates="machines")
    required_qualification: Mapped["Qualification"] = relationship()


class OperatorProfile(Base):
    __tablename__ = "operator_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    hourly_rate_net: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(back_populates="operator_profile")
    qualifications: Mapped[list["OperatorQualification"]] = relationship(back_populates="operator")


class OperatorQualification(Base):
    __tablename__ = "operator_qualifications"

    operator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("operator_profiles.user_id"), primary_key=True)
    qualification_id: Mapped[int] = mapped_column(ForeignKey("qualifications.id"), primary_key=True)
    valid_until: Mapped[date] = mapped_column(Date, nullable=False)

    operator: Mapped["OperatorProfile"] = relationship(back_populates="qualifications")
    qualification: Mapped["Qualification"] = relationship()


class TransportVehicle(Base):
    __tablename__ = "transport_vehicles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    plate_number: Mapped[str] = mapped_column(String(32), nullable=False)
    max_weight_tons: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=Decimal("20.00"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    organization: Mapped["Organization"] = relationship(back_populates="transport_vehicles")


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    machine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("machines.id"), nullable=False)
    operator_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("operator_profiles.user_id"))
    transport_vehicle_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("transport_vehicles.id"))

    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    with_operator: Mapped[bool] = mapped_column(Boolean, default=False)
    with_transport: Mapped[bool] = mapped_column(Boolean, default=False)
    delivery_address: Mapped[str | None] = mapped_column(String(512))
    delivery_lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    delivery_lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))

    total_price_net: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    deposit_paid: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    has_damage_waiver: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.PENDING)
    contract_pdf_url: Mapped[str | None] = mapped_column(String(512))

    # Gwarancja braku nakładania się rezerwacji dla tej samej maszyny na poziomie PostgreSQL
    __table_args__ = (
    ExcludeConstraint(
        ("machine_id", "="),
        (func.tstzrange(start_time, end_time, "[)"), "&&"),
        name="excl_machine_booking_overlap",
        using="gist",
        where=text("status != 'CANCELLED'"),
    ),
    ExcludeConstraint(
        ("transport_vehicle_id", "="),
        (func.tstzrange(start_time, end_time, "[)"), "&&"),
        name="excl_transport_booking_overlap",
        using="gist",
        where=text("status != 'CANCELLED' AND transport_vehicle_id IS NOT NULL"),
    ),
)
    


class UnavailabilityBlock(Base):
    __tablename__ = "unavailability_blocks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("machines.id"))
    operator_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("operator_profiles.user_id"))
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[BlockReason] = mapped_column(Enum(BlockReason), nullable=False)


class HandoverProtocol(Base):
    __tablename__ = "handover_protocols"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    protocol_type: Mapped[str] = mapped_column(String(16), nullable=False)  # PICKUP / RETURN
    engine_hours_reading: Mapped[Decimal] = mapped_column(Numeric(10, 1), nullable=False)
    photos_urls: Mapped[list] = mapped_column(JSONB, default=list)
    client_signature_url: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())