from datetime import datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field, field_validator
from app.models import BookingStatus, BlockReason


class BookingCreate(BaseModel):
    machine_id: UUID
    start_time: datetime
    end_time: datetime
    with_operator: bool = True
    with_transport: bool = False
    delivery_address: str | None = Field(default=None, example="ul. Fordońska 40, Bydgoszcz")
    delivery_lat: Decimal | None = Field(default=Decimal("53.126000"))
    delivery_lng: Decimal | None = Field(default=Decimal("18.045000"))
    has_damage_waiver: bool = False


class BookingResponse(BaseModel):
    id: UUID
    machine_id: UUID
    operator_id: UUID | None
    start_time: datetime
    end_time: datetime
    with_operator: bool
    with_transport: bool
    delivery_address: str | None
    total_price_net: Decimal
    deposit_amount: Decimal
    status: str

    class Config:
        from_attributes = True
        

class BookingQuoteResponse(BaseModel):
    hours: float
    days: int
    machine_cost: Decimal
    operator_cost: Decimal
    operator_hourly_rate: Decimal | None = None
    transport_cost: Decimal
    distance_km_one_way: float | None = None
    transport_buffer_hours: float | None = None
    total_net: Decimal
    total_gross: Decimal
    deposit_amount: Decimal
    available: bool = True
    unavailable_reason: str | None = None


class BookingStatusUpdate(BaseModel):
    status: BookingStatus


class HandoverCreate(BaseModel):
    protocol_type: str = Field(..., pattern="^(PICKUP|RETURN)$", example="PICKUP")
    engine_hours_reading: Decimal = Field(..., ge=0, example=1450.5)
    notes: str | None = Field(default=None, example="Maszyna zatankowana do pełna, brak uszkodzeń.")


class BlockCreate(BaseModel):
    machine_id: UUID
    start_time: datetime
    end_time: datetime
    reason: BlockReason = BlockReason.MAINTENANCE

    @field_validator("reason", mode="before")
    @classmethod
    def normalize_reason(cls, v):
        if isinstance(v, str):
            for member in BlockReason:
                if v.lower() == member.value.lower() or v.upper() == member.name.upper():
                    return member
        return v

class LoginRequest(BaseModel):
    email: str
    password: str


class MachineCreate(BaseModel):
    name: str
    category: str
    daily_rate_net: Decimal
    deposit_amount: Decimal
    transport_rate_per_km: Decimal = Decimal("14.00")
    service_buffer_hours: int = 2


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: UUID
    full_name: str
    role: str