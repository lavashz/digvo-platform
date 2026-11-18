export interface Machine {
  id: string;
  organization_id?: string;
  organization_name?: string;
  base_lat?: number | null;
  base_lng?: number | null;
  name: string;
  category: string;
  daily_rate_net: number;
  deposit_amount: number;
  transport_rate_per_km: number;
  service_buffer_hours: number;
}

export interface BookingQuote {
  hours: number;
  days: number;
  machine_cost: number;
  operator_cost: number;
  operator_hourly_rate: number | null;
  transport_cost: number;
  distance_km_one_way: number | null;
  transport_buffer_hours: number | null;
  total_net: number;
  total_gross: number;
  deposit_amount: number;
  available: boolean;
  unavailable_reason: string | null;
  assigned_operator_name: string | null;
  operator_selection_score: number | null;
  operator_week_load_hours: number | null;
}

export interface SitePreset {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

export interface Protocol {
  protocol_type: "PICKUP" | "RETURN";
  engine_hours_reading: number;
  created_at: string;
}

export interface Booking {
  id: string;
  client_id: string;
  machine_id: string;
  operator_id: string | null;
  operator_name: string | null;
  start_time: string;
  end_time: string;
  delivery_address: string | null;
  total_price_net: number;
  status: string;
  protocols: Protocol[];
}

export interface UnavailabilityBlock {
  id: string;
  machine_id: string;
  start_time: string;
  end_time: string;
  reason: string;
}

export interface AuthUser {
  token: string;
  full_name: string;
  role: "CLIENT" | "DISPATCHER" | "OPERATOR" | "ADMIN";
}

export interface VendorInfo {
  id: string;
  name: string;
  shortName: string;
  district: string;
  rating: string;
  badgeColor: string;
}