"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LoginModal, { type RegisterPayload } from "./components/LoginModal";
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  FileIcon,
  HardHatIcon,
  LogoutIcon,
  MachineGlyph,
  PinIcon,
  SearchIcon,
  SpinnerIcon,
  SwitchIcon,
  TruckIcon,
  XIcon,
} from "./components/Icons";
import { t, formatMoney, type Locale, type Currency } from "./lib/i18n";

interface Machine {
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

interface BookingQuote {
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

interface SitePreset {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

interface Protocol {
  protocol_type: "PICKUP" | "RETURN";
  engine_hours_reading: number;
  created_at: string;
}

interface Booking {
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

interface UnavailabilityBlock {
  id: string;
  machine_id: string;
  start_time: string;
  end_time: string;
  reason: string;
}

interface AuthUser {
  token: string;
  full_name: string;
  role: "CLIENT" | "DISPATCHER" | "OPERATOR" | "ADMIN";
}

interface VendorInfo {
  id: string;
  name: string;
  shortName: string;
  district: string;
  rating: string;
  badgeColor: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const AUTH_STORAGE_KEY = "digvo_auth_user";

const VENDORS: Record<string, VendorInfo> = {
  KUJAWY: {
    id: "KUJAWY",
    name: "Kujawy Maszyny Sp. z o.o.",
    shortName: "Kujawy Maszyny",
    district: "Bydgoszcz • Fordon",
    rating: "4.9 ★",
    badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  TERRARENT: {
    id: "TERRARENT",
    name: "TerraRent Bydgoszcz Sp. z o.o.",
    shortName: "TerraRent Bydgoszcz",
    district: "Bydgoszcz • ul. Przemysłowa",
    rating: "4.8 ★",
    badgeColor: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  },
  BUDLIFT: {
    id: "BUDLIFT",
    name: "Budlift Białe Błota Sp. z o.o.",
    shortName: "Budlift Białe Błota",
    district: "Białe Błota k. Bydgoszczy",
    rating: "4.9 ★",
    badgeColor: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  },
};

function resolveMachineVendor(machine: Machine): VendorInfo {
  const org = (machine.organization_name || "").toLowerCase();
  if (org.includes("terrarent")) return VENDORS.TERRARENT;
  if (org.includes("budlift")) return VENDORS.BUDLIFT;
  if (org.includes("kujawy")) return VENDORS.KUJAWY;

  const n = machine.name.toLowerCase();
  if (n.includes("volvo") || n.includes("428f2") || n.includes("liebherr")) {
    return VENDORS.TERRARENT;
  }
  if (n.includes("kubota") || n.includes("manitou")) {
    return VENDORS.BUDLIFT;
  }
  return VENDORS.KUJAWY;
}

const SITE_PRESETS: SitePreset[] = [
  {
    id: "fordon",
    label: "Bydgoszcz • Fordon",
    address: "ul. Fordońska 40, Bydgoszcz",
    lat: 53.1482,
    lng: 18.1705,
  },
  {
    id: "bppt",
    label: "Bydgoszcz • BPPT",
    address: "ul. Przemysłowa 24, Bydgoszcz",
    lat: 53.126,
    lng: 18.045,
  },
  {
    id: "torun",
    label: "Toruń • Wschodnia",
    address: "ul. Włocławska 167, Toruń",
    lat: 53.0138,
    lng: 18.5981,
  },
  {
    id: "inowroclaw",
    label: "Inowrocław • budowa",
    address: "ul. Dworcowa 12, Inowrocław",
    lat: 52.7957,
    lng: 18.2636,
  },
];

const DEMO_ACCOUNTS = [
  { label: "Klient B2B: PW Lech Budownictwo (Bydgoszcz)", email: "zamowienia@pwlech-bydgoszcz.pl", role: "CLIENT" },
  { label: "Klient B2B: Ebud-Przemysłówka S.A. (BPPT)", email: "logistyka@ebud-bydgoszcz.pl", role: "CLIENT" },
  { label: "Klient B2B: KPPRD Inżynieria Drogowa", email: "sprzet@kpprd.pl", role: "CLIENT" },
  { label: "Klient B2B: Aqua-Instal Fordon", email: "biuro@aquainstal-fordon.pl", role: "CLIENT" },
  { label: "Klient: Tomasz Zieliński (Inwestor Fordon)", email: "inwestor@budowa-fordon.pl", role: "CLIENT" },
  { label: "Dyspozytor Floty: Marek Wiśniewski", email: "dyspozytor@kujawy-maszyny.pl", role: "DISPATCHER" },
  { label: "Operator UDT: Jan Kowalski", email: "j.kowalski@kujawy-maszyny.pl", role: "OPERATOR" },
  { label: "Operator UDT: Piotr Nowak", email: "p.nowak@terrarent-bydgoszcz.pl", role: "OPERATOR" },
];

function formatApiError(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((err: { msg?: string }) => err.msg || "Błąd walidacji")
      .join(", ");
  }
  return fallback;
}

export default function DigvoDashboard() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<"client" | "dispatcher" | "operator">("client");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [vendorFilter, setVendorFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [machines, setMachines] = useState<Machine[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<UnavailabilityBlock[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const [locale, setLocale] = useState<Locale>("pl");
  const [currency, setCurrency] = useState<Currency>("PLN");
  const [eurRate, setEurRate] = useState(4.25);

  // Konfigurator wynajmu
  const [date, setDate] = useState("2026-11-26");
  const [startHour, setStartHour] = useState("08:00");
  const [endHour, setEndHour] = useState("16:00");
  const [withOperator, setWithOperator] = useState(true);
  const [withTransport, setWithTransport] = useState(true);
  const [siteId, setSiteId] = useState(SITE_PRESETS[0].id);
  const [address, setAddress] = useState(SITE_PRESETS[0].address);
  const [deliveryLat, setDeliveryLat] = useState(SITE_PRESETS[0].lat);
  const [deliveryLng, setDeliveryLng] = useState(SITE_PRESETS[0].lng);
  
  // Dyspozytor
  const [blockMachineId, setBlockMachineId] = useState("");
  const [blockDate, setBlockDate] = useState("2026-11-27");
  const [blockReason, setBlockReason] = useState("MAINTENANCE");

  const [newMachineName, setNewMachineName] = useState("");
  const [newMachineCategory, setNewMachineCategory] = useState("Minikoparki");
  const [newMachineRate, setNewMachineRate] = useState("450");
  const [newMachineDeposit, setNewMachineDeposit] = useState("1000");
  const [newMachineBuffer, setNewMachineBuffer] = useState("2");

  // Operator
  const [mthInputs, setMthInputs] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchMyBookings = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/bookings/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyBookings(data);
      } else if (res.status === 401) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setAuthUser(null);
        setMyBookings([]);
      }
    } catch {
      // Ciche pominięcie w tle
    }
  };

  const fetchData = async (currentToken?: string) => {
    try {
      const [mRes, bRes, blRes] = await Promise.all([
        fetch(`${API_URL}/machines`),
        fetch(`${API_URL}/bookings`),
        fetch(`${API_URL}/blocks`),
      ]);
      const mData = await mRes.json();
      const bData = await bRes.json();
      const blData = await blRes.json();
      setMachines(mData);
      setBookings(bData);
      setBlocks(blData);
      if (mData.length > 0) {
        setSelectedMachine((prev) => prev || mData[0]);
        setBlockMachineId((prev) => prev || mData[0].id);
      }
      const tokenToUse = currentToken || authUser?.token;
      if (tokenToUse) {
        await fetchMyBookings(tokenToUse);
      }
    } catch {
      setMessage({
        type: "error",
        text: "Trwa wybudzanie klastra API. Odśwież stronę za kilka sekund.",
      });
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 6000);
    return () => window.clearTimeout(t);
  }, [message]);

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) {
      try {
        const parsed: AuthUser = JSON.parse(saved);
        setAuthUser(parsed);
        if (parsed.role === "DISPATCHER") setActiveTab("dispatcher");
        else if (parsed.role === "OPERATOR") setActiveTab("operator");
        else setActiveTab("client");
        fetchData(parsed.token);
        return;
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    fetchData();
  }, []);

  const closeLogin = useCallback(() => {
    setShowLogin(false);
    setLoginError(null);
  }, []);

  const clearLoginError = useCallback(() => setLoginError(null), []);

  const performLogin = async (targetEmail: string, targetPassword: string): Promise<boolean> => {
    setMessage(null);
    setLoginError(null);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(formatApiError(data.detail, "Błąd logowania."));
        return false;
      }
      const userObj: AuthUser = {
        token: data.access_token,
        full_name: data.full_name,
        role: data.role,
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userObj));
      setAuthUser(userObj);
      if (data.role === "DISPATCHER") setActiveTab("dispatcher");
      else if (data.role === "OPERATOR") setActiveTab("operator");
      else setActiveTab("client");

      await fetchMyBookings(data.access_token);
      setShowLogin(false);
      setMessage({ type: "success", text: `Zalogowano jako ${data.full_name}` });
      return true;
    } catch {
      setLoginError("Błąd połączenia z serwerem autoryzacji.");
      return false;
    }
  };

  const performRegister = async (payload: RegisterPayload): Promise<boolean> => {
  setMessage(null);
  setLoginError(null);
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoginError(formatApiError(data.detail, "Błąd rejestracji."));
      return false;
    }
    const userObj: AuthUser = {
      token: data.access_token,
      full_name: data.full_name,
      role: data.role,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userObj));
    setAuthUser(userObj);
    setActiveTab("client");
    await fetchMyBookings(data.access_token);
    setShowLogin(false);
    setMessage({ type: "success", text: `Konto utworzone. Zalogowano jako ${data.full_name}` });
    return true;
  } catch {
    setLoginError("Błąd połączenia z serwerem przy rejestracji.");
    return false;
  }
};

  const handleQuickAccountSelect = async (selectedEmail: string): Promise<boolean> => {
    if (!selectedEmail) return false;
    return performLogin(selectedEmail, "haslo123");
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthUser(null);
    setMyBookings([]);
    setActiveTab("client");
    setMenuOpen(false);
    setMessage({ type: "success", text: "Wylogowano z konta." });
  };

  const authHeaders = () => ({
    "Content-Type": "application/json",
    ...(authUser ? { Authorization: `Bearer ${authUser.token}` } : {}),
  });

  const estimate = {
  hours: quote?.hours ?? 0,
  days: quote?.days ?? 1,
  machineCost: quote?.machine_cost ?? 0,
  operatorCost: quote?.operator_cost ?? 0,
  transportCost: quote?.transport_cost ?? 0,
  totalNet: quote?.total_net ?? 0,
  totalGross: quote?.total_gross ?? 0,
};

useEffect(() => {
  if (!selectedMachine) {
    setQuote(null);
    return;
  }

  const controller = new AbortController();
  const timer = window.setTimeout(async () => {
    setQuoteLoading(true);
    try {
      const res = await fetch(`${API_URL}/bookings/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          machine_id: selectedMachine.id,
          start_time: `${date}T${startHour}:00`,
          end_time: `${date}T${endHour}:00`,
          with_operator: withOperator,
          with_transport: withTransport,
          delivery_address: withTransport ? address : null,
          delivery_lat: withTransport ? deliveryLat : null,
          delivery_lng: withTransport ? deliveryLng : null,
          has_damage_waiver: false,
}),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuote(null);
        return;
      }
      setQuote(data);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, 300);

  return () => {
    controller.abort();
    window.clearTimeout(timer);
  };
}, [selectedMachine, date, startHour, endHour, withOperator, withTransport, address, deliveryLat, deliveryLng]);

  useEffect(() => {
    fetch(`${API_URL}/fx/eur`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.rate) setEurRate(Number(d.rate));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    localStorage.setItem("digvo_locale", locale);
    localStorage.setItem("digvo_currency", currency);
  }, [locale, currency]);

  useEffect(() => {
    const savedLocale = localStorage.getItem("digvo_locale");
    const savedCurrency = localStorage.getItem("digvo_currency");
    if (savedLocale === "pl" || savedLocale === "en") setLocale(savedLocale);
    if (savedCurrency === "PLN" || savedCurrency === "EUR") setCurrency(savedCurrency);
  }, []);

  const money = (amountPln: number) => formatMoney(amountPln, currency, eurRate);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachine) return;
    if (!authUser) {
      setShowLogin(true);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/bookings`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          machine_id: selectedMachine.id,
          start_time: `${date}T${startHour}:00`,
          end_time: `${date}T${endHour}:00`,
          with_operator: withOperator,
          with_transport: withTransport,
          delivery_address: withTransport ? address : null,
          delivery_lat: withTransport ? deliveryLat : null,
          delivery_lng: withTransport ? deliveryLng : null,
          has_damage_waiver: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: formatApiError(data.detail, "Błąd rezerwacji.") });
      } else {
        const vendor = resolveMachineVendor(selectedMachine);
        setMessage({
          type: "success",
          text: `Potwierdzono rezerwację w ${vendor.shortName} (${selectedMachine.name}). Kwota netto: ${data.total_price_net} PLN.`,
        });
        fetchData();
      }
    } catch {
      setMessage({ type: "error", text: "Błąd sieci podczas wysyłania rezerwacji." });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockMachineId || !authUser) return;
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/blocks`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          machine_id: blockMachineId,
          start_time: `${blockDate}T00:00:00`,
          end_time: `${blockDate}T23:59:00`,
          reason: blockReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        fetchData();
      } else {
        setMessage({ type: "error", text: formatApiError(data.detail, "Błąd dodawania blokady.") });
      }
    } catch {
      setMessage({ type: "error", text: "Błąd sieci podczas dodawania blokady." });
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!authUser) return;
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/blocks/${blockId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        fetchData();
      } else {
        setMessage({ type: "error", text: formatApiError(data.detail, "Nie udało się usunąć blokady.") });
      }
    } catch {
      setMessage({ type: "error", text: "Błąd sieci podczas usuwania blokady." });
    }
  };

  const handleCreateMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/machines`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: newMachineName,
          category: newMachineCategory,
          daily_rate_net: Number(newMachineRate),
          deposit_amount: Number(newMachineDeposit),
          transport_rate_per_km: 14,
          service_buffer_hours: Number(newMachineBuffer),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        setNewMachineName("");
        fetchData();
      } else {
        setMessage({ type: "error", text: formatApiError(data.detail, "Błąd dodawania maszyny.") });
      }
    } catch {
      setMessage({ type: "error", text: "Błąd sieci podczas dodawania maszyny." });
    }
  };

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    if (!authUser) return;
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Zmieniono status zlecenia na ${newStatus}.` });
        fetchData();
      } else {
        setMessage({ type: "error", text: formatApiError(data.detail, "Brak uprawnień.") });
      }
    } catch {
      setMessage({ type: "error", text: "Nie udało się zaktualizować statusu." });
    }
  };

  const handleHandover = async (bookingId: string, protocolType: "PICKUP" | "RETURN") => {
    if (!authUser) return;
    const val = mthInputs[bookingId];
    if (!val || isNaN(Number(val))) {
      setMessage({ type: "error", text: "Wpisz poprawny stan licznika motogodzin (mth)." });
      return;
    }

    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/bookings/${bookingId}/handover`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          protocol_type: protocolType,
          engine_hours_reading: Number(val),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: formatApiError(data.detail, "Błąd zapisu protokołu.") });
      } else {
        setMessage({ type: "success", text: data.message });
        setMthInputs((prev) => ({ ...prev, [bookingId]: "" }));
        fetchData();
      }
    } catch {
      setMessage({ type: "error", text: "Błąd sieci podczas zapisywania protokołu." });
    }
  };

  const getMachineName = (id: string) =>
    machines.find((m) => m.id === id)?.name || "Nieznana maszyna";

  const statusMeta = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return { label: "Potwierdzone", cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" };
      case "IN_PROGRESS":
        return { label: "W trakcie pracy", cls: "bg-amber-500/10 text-amber-300 border border-amber-500/20" };
      case "COMPLETED":
        return { label: "Zakończone", cls: "bg-sky-500/10 text-sky-300 border border-sky-500/20" };
      case "CANCELLED":
        return { label: "Anulowane", cls: "bg-rose-500/10 text-rose-400 border border-rose-500/20" };
      default:
        return { label: "Oczekujące", cls: "bg-white/[0.06] text-zinc-300 border border-white/[0.08]" };
    }
  };

  const totalRevenueNet = bookings
    .filter((b) => b.status !== "CANCELLED")
    .reduce((sum, b) => sum + b.total_price_net, 0);

  const activeBookingsCount = bookings.filter(
    (b) => b.status === "CONFIRMED" || b.status === "IN_PROGRESS"
  ).length;

  const totalWorkedMth = bookings.reduce((sum, b) => {
    const pickup = b.protocols.find((p) => p.protocol_type === "PICKUP");
    const ret = b.protocols.find((p) => p.protocol_type === "RETURN");
    if (pickup && ret && ret.engine_hours_reading >= pickup.engine_hours_reading) {
      return sum + (ret.engine_hours_reading - pickup.engine_hours_reading);
    }
    return sum;
  }, 0);

  const getMachineAvailability = (machine: Machine) => {
    if (!date || !startHour || !endHour) {
      return { available: true, label: "Dostępna", dot: "bg-emerald-400", text: "text-emerald-400" };
    }

    const reqStart = new Date(`${date}T${startHour}:00`).getTime();
    const reqEnd = new Date(`${date}T${endHour}:00`).getTime();
    if (isNaN(reqStart) || isNaN(reqEnd) || reqEnd <= reqStart) {
      return { available: true, label: "Dostępna", dot: "bg-emerald-400", text: "text-emerald-400" };
    }

    const bufferMs = machine.service_buffer_hours * 60 * 60 * 1000;

    const hasBlock = blocks.some((bl) => {
      if (bl.machine_id !== machine.id) return false;
      const blStart = new Date(bl.start_time).getTime();
      const blEnd = new Date(bl.end_time).getTime();
      return reqStart < blEnd && reqEnd > blStart;
    });

    if (hasBlock) {
      return {
        available: false,
        label: "Przegląd UDT",
        dot: "bg-rose-400",
        text: "text-rose-400",
      };
    }

    const hasBookingConflict = bookings.some((b) => {
      if (b.machine_id !== machine.id || b.status === "CANCELLED") return false;
      const bStart = new Date(b.start_time).getTime() - bufferMs;
      const bEnd = new Date(b.end_time).getTime() + bufferMs;
      return reqStart < bEnd && reqEnd > bStart;
    });

    if (hasBookingConflict) {
      return {
        available: false,
        label: "Zajęta",
        dot: "bg-amber-400",
        text: "text-amber-400",
      };
    }

    return {
      available: true,
      label: "Dostępna",
      dot: "bg-emerald-400",
      text: "text-emerald-400",
    };
  };

  const categories = useMemo(() => {
    const unique = Array.from(new Set(machines.map((m) => m.category)));
    return ["ALL", ...unique];
  }, [machines]);

  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      const vendor = resolveMachineVendor(m);
      const matchesVendor = vendorFilter === "ALL" || vendor.id === vendorFilter;
      const matchesCategory = categoryFilter === "ALL" || m.category === categoryFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesVendor && matchesCategory && matchesSearch;
    });
  }, [machines, vendorFilter, categoryFilter, searchQuery]);

  const filteredBookings =
    statusFilter === "ALL"
      ? bookings
      : bookings.filter((b) => b.status === statusFilter);

  const selectedAvailability = selectedMachine ? getMachineAvailability(selectedMachine) : null;
  const selectedVendor = selectedMachine ? resolveMachineVendor(selectedMachine) : null;

  const tabs: { key: "client" | "dispatcher" | "operator"; label: string; count?: number }[] = [
    { key: "client", label: t(locale, "marketplace") },
    { key: "dispatcher", label: t(locale, "dispatcher"), count: bookings.length },
    { key: "operator", label: t(locale, "operator") },
  ];

  const renderTabs = (extra: string) => (
    <nav
      aria-label="Widoki platformy"
      className={`flex items-center bg-black/50 border border-white/[0.08] p-1 rounded-full ${extra}`}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => setActiveTab(t.key)}
          aria-current={activeTab === t.key ? "page" : undefined}
          className={`flex-1 md:flex-none px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 flex items-center justify-center gap-1.5 ${activeTab === t.key
              ? "bg-white text-black shadow-sm"
              : "text-zinc-400 hover:text-white"
            }`}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={`text-[10px] leading-none px-1.5 py-1 rounded-full ${activeTab === t.key ? "bg-black/10 text-black" : "bg-white/[0.08] text-zinc-300"
                }`}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </nav>
  );

  const userInitials = authUser
    ? authUser.full_name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase()
    : "";

  return (
    <div className="min-h-screen bg-black text-[#f5f5f7] font-sans antialiased">
      {/* ===== NAWIGACJA (szkło) ===== */}
      <header className="sticky top-0 z-40 glass border-b border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => setActiveTab("client")}
            className="flex items-center gap-3 press"
            aria-label="Digvo — strona główna"
          >
            <span className="relative w-9 h-9 rounded-xl bg-white text-black font-bold text-lg tracking-tighter flex items-center justify-center overflow-hidden">
              D
              <span className="hazard absolute bottom-0 inset-x-0 h-1.5" />
            </span>
            <span className="text-[17px] font-semibold tracking-tight text-white">Digvo</span>
            <span className="hidden lg:inline text-xs text-zinc-500 border-l border-white/10 pl-3">
              Equipment Cloud · Bydgoszcz
            </span>
          </button>

          {renderTabs("hidden md:flex")}

          <div className="hidden sm:flex items-center gap-1 mr-1">
            <div className="flex bg-black/50 border border-white/[0.08] p-0.5 rounded-full">
              {(["pl", "en"] as Locale[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase ${
                    locale === code ? "bg-white text-black" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
            <div className="flex bg-black/50 border border-white/[0.08] p-0.5 rounded-full">
              {(["PLN", "EUR"] as Currency[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCurrency(code)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                    currency === code ? "bg-white text-black" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          {authUser ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-2.5 pl-1.5 pr-3 sm:pr-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition press"
              >
                <span className="w-7 h-7 rounded-full bg-linear-to-br from-brand-soft to-orange-500 text-black text-[11px] font-bold flex items-center justify-center">
                  {userInitials}
                </span>
                <span className="hidden sm:block text-xs font-medium text-zinc-200 max-w-[9rem] truncate">
                  {authUser.full_name}
                </span>
              </button>

              {menuOpen && (
                <>
                  <button
                    aria-label="Zamknij menu konta"
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-40 cursor-default"
                  />
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-72 z-50 glass-strong border border-white/[0.1] rounded-2xl p-2 shadow-2xl shadow-black/70 animate-pop-in"
                  >
                    <div className="px-3 py-3 border-b border-white/[0.07] mb-1">
                      <p className="text-sm font-semibold text-white truncate">{authUser.full_name}</p>
                      <span className="inline-flex items-center gap-1.5 mt-1.5 text-[11px] text-zinc-300 bg-white/[0.07] px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {ROLE_LABEL[authUser.role] ?? authUser.role}
                      </span>
                    </div>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        setShowLogin(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-200 hover:bg-white/[0.07] transition text-left"
                    >
                      <SwitchIcon className="w-4 h-4 text-zinc-400" />
                      Przełącz konto lub rolę
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-rose-300 hover:bg-rose-500/10 transition text-left"
                    >
                      <LogoutIcon className="w-4 h-4" />
                      {t(locale, "logout")}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="bg-white hover:bg-zinc-200 text-black text-[13px] font-semibold px-5 py-2 rounded-full transition press"
            >
              {t(locale, "login")}
            </button>
          )}
        </div>

        <div className="md:hidden px-5 pb-3">{renderTabs("w-full")}</div>
      </header>

      {/* ===== POWIADOMIENIA ===== */}
      {message && (
        <div className="fixed z-[60] inset-x-0 top-[7.25rem] md:top-[5rem] flex justify-center px-4 pointer-events-none">
          <div
            role="status"
            className={`pointer-events-auto flex items-center gap-3 max-w-xl w-full sm:w-auto pl-4 pr-2 py-2.5 rounded-2xl border glass-strong shadow-2xl shadow-black/60 animate-pop-in ${message.type === "success"
                ? "border-emerald-500/30 text-emerald-100"
                : "border-rose-500/35 text-rose-100"
              }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${message.type === "success" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                }`}
            >
              {message.type === "success" ? <CheckIcon className="w-3 h-3" /> : <XIcon className="w-3 h-3" />}
            </span>
            <span className="text-[13px] leading-snug flex-1">{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              aria-label="Zamknij powiadomienie"
              className="w-7 h-7 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.08] flex items-center justify-center shrink-0 transition"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <main>
        {/* =====================================================
            1. MARKETPLACE (WIDOK KLIENTA)
        ===================================================== */}
        {activeTab === "client" && (
          <div>
            {/* HERO */}
            <section className="relative overflow-hidden border-b border-white/[0.06]">
              <div className="absolute inset-0 hero-glow pointer-events-none" />
              <div className="absolute inset-0 grid-bg pointer-events-none" />
              <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-16 sm:pt-24 pb-14 sm:pb-20 text-center">
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand bg-brand/10 border border-brand/25 rounded-full px-3.5 py-1.5 animate-fade-up">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                  Bydgoszcz i woj. kujawsko-pomorskie
                </span>
                <h1
                  className="mt-7 text-[2.6rem] sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.04] animate-fade-up"
                  style={{ animationDelay: "80ms" }}
                >
                  <span className="text-gradient">{t(locale, "heroTitle1")}</span>
                  <br />
                  <span className="text-gradient-brand">{t(locale, "heroTitle2")}</span>
                </h1>
                <p
                  className="mt-6 mx-auto max-w-2xl text-base sm:text-lg text-zinc-400 leading-relaxed animate-fade-up"
                  style={{ animationDelay: "160ms" }}
                >
                  {t(locale, "heroSub")}
                </p>

                <div
                  className="mt-9 flex flex-wrap items-center justify-center gap-3 animate-fade-up"
                  style={{ animationDelay: "240ms" }}
                >
                  <a
                    href="#katalog"
                    className="inline-flex items-center gap-2 bg-brand hover:bg-brand-soft text-black font-semibold text-sm px-7 py-3.5 rounded-full transition press shadow-lg shadow-brand/20"
                  >
                    {t(locale, "browse")}
                    <ArrowRightIcon className="w-4 h-4" />
                  </a>
                  {authUser ? (
                    <a
                      href="#rezerwacje"
                      className="inline-flex items-center gap-2 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-white font-medium text-sm px-7 py-3.5 rounded-full transition press"
                    >
                      {t(locale, "myBookings")}
                    </a>
                  ) : (
                    <button
                      onClick={() => setShowLogin(true)}
                      className="inline-flex items-center gap-2 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-white font-medium text-sm px-7 py-3.5 rounded-full transition press"
                    >
                      {t(locale, "login")}
                    </button>
                  )}
                </div>

                <dl
                  className="mt-14 mx-auto max-w-2xl grid grid-cols-3 gap-px bg-white/[0.08] rounded-3xl overflow-hidden border border-white/[0.08] animate-fade-up"
                  style={{ animationDelay: "320ms" }}
                >
                  {[
                    { value: String(machines.length), label: t(locale, "machinesInDb"), cls: "text-white" },
                    { value: "3", label: t(locale, "vendorsOnMarket"), cls: "text-white" },
                    { value: "100%", label: t(locale, "udtReviews"), cls: "text-emerald-400" },
                  ].map((s) => (
                    <div key={s.label} className="bg-black/70 backdrop-blur px-3 py-5 sm:py-6">
                      <dt className="sr-only">{s.label}</dt>
                      <dd className={`text-2xl sm:text-4xl font-semibold tracking-tight ${s.cls}`}>{s.value}</dd>
                      <p className="mt-1 text-[11px] sm:text-xs text-zinc-500">{s.label}</p>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="hazard h-1.5 w-full opacity-90" />
            </section>

            <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14 space-y-20">
              {/* JAK TO DZIAŁA */}
              <section aria-labelledby="how-title">
                <h2 id="how-title" className="sr-only">
                  Jak to działa
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      icon: <SearchIcon className="w-5 h-5" />,
                      title: "Wybierz maszynę",
                      text: "Katalog pokazuje dostępność w wybranym terminie, z uwzględnieniem czasu na serwis.",
                    },
                    {
                      icon: <HardHatIcon className="w-5 h-5" />,
                      title: "Dodaj operatora i transport",
                      text: "Operator z uprawnieniami UDT oraz dostawa na budowę — jednym przełącznikiem.",
                    },
                    {
                      icon: <FileIcon className="w-5 h-5" />,
                      title: "Odbierz umowę PDF",
                      text: "Po potwierdzeniu rezerwacji pobierasz gotową umowę najmu bez dodatkowych formalności.",
                    },
                  ].map((s, i) => (
                    <div key={s.title} className="surface rounded-3xl p-6 card-lift hover:border-white/[0.16]">
                      <div className="flex items-center justify-between">
                        <span className="w-11 h-11 rounded-2xl bg-brand/10 border border-brand/20 text-brand flex items-center justify-center">
                          {s.icon}
                        </span>
                        <span className="text-xs font-mono text-zinc-600">0{i + 1}</span>
                      </div>
                      <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">{s.title}</h3>
                      <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">{s.text}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* KATALOG + KONFIGURATOR */}
              <section id="katalog" className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
                  <div>
                    <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">Katalog sprzętu</h2>
                    <p className="mt-1.5 text-sm text-zinc-400">
                      {filteredMachines.length} z {machines.length} maszyn dostępnych na platformie
                    </p>
                  </div>
                  <div className="relative w-full md:w-80">
                    <SearchIcon className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Szukaj modelu, marki lub dostawcy…"
                      aria-label="Szukaj sprzętu"
                      className={`${inputCls} rounded-full pl-10 text-[13px]`}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0 sm:flex-wrap">
                    <button
                      onClick={() => setVendorFilter("ALL")}
                      className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium transition press ${vendorFilter === "ALL"
                          ? "bg-white text-black font-semibold"
                          : "bg-panel-2 text-zinc-300 border border-white/[0.08] hover:border-white/[0.2]"
                        }`}
                    >
                      Wszystkie wypożyczalnie ({machines.length})
                    </button>
                    {Object.values(VENDORS).map((v) => {
                      const count = machines.filter((m) => resolveMachineVendor(m).id === v.id).length;
                      return (
                        <button
                          key={v.id}
                          onClick={() => setVendorFilter(v.id)}
                          className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium transition press flex items-center gap-2 ${vendorFilter === v.id
                              ? "bg-white text-black font-semibold"
                              : "bg-panel-2 text-zinc-300 border border-white/[0.08] hover:border-white/[0.2]"
                            }`}
                        >
                          {v.shortName}
                          <span
                            className={`text-[10px] leading-none px-1.5 py-1 rounded-full ${vendorFilter === v.id ? "bg-black/10 text-black" : "bg-white/[0.08] text-zinc-400"
                              }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0 sm:flex-wrap">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-medium transition press ${categoryFilter === cat
                            ? "bg-brand/15 text-brand-soft border border-brand/35"
                            : "text-zinc-400 hover:text-zinc-200 bg-white/[0.03] border border-transparent"
                          }`}
                      >
                        {cat === "ALL" ? "Wszystkie kategorie" : cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* KARTY MASZYN */}
                  <div className="lg:col-span-7">
                    {initialLoading ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map((n) => (
                          <div key={n} className="h-72 rounded-3xl border border-white/[0.06] skeleton" />
                        ))}
                      </div>
                    ) : filteredMachines.length === 0 ? (
                      <div className="surface rounded-3xl p-12 text-center">
                        <p className="text-base font-medium text-white">Brak wyników</p>
                        <p className="mt-1 text-sm text-zinc-400">
                          Zmień filtry lub wyszukiwaną frazę, aby zobaczyć więcej maszyn.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {filteredMachines.map((m) => {
                          const isSelected = selectedMachine?.id === m.id;
                          const availability = getMachineAvailability(m);
                          const vendor = resolveMachineVendor(m);

                          return (
                            <button
                              type="button"
                              key={m.id}
                              onClick={() => setSelectedMachine(m)}
                              aria-pressed={isSelected}
                              className={`group text-left card-lift rounded-3xl overflow-hidden flex flex-col border ${isSelected
                                  ? "border-brand bg-panel-2 shadow-2xl shadow-brand/10"
                                  : "border-white/[0.08] bg-panel hover:border-white/[0.2]"
                                }`}
                            >
                              <span className="machine-stage relative block h-36">
                                <span className="absolute inset-0 flex items-center justify-center">
                                  <MachineGlyph
                                    category={m.category}
                                    className={`w-32 h-24 transition-all duration-300 group-hover:scale-105 ${isSelected ? "text-brand" : "text-zinc-600 group-hover:text-brand-soft"
                                      }`}
                                  />
                                </span>
                                <span
                                  className={`absolute top-3.5 left-3.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${vendor.badgeColor}`}
                                >
                                  {vendor.shortName}
                                </span>
                                <span className="absolute top-3.5 right-3.5 flex items-center gap-1.5 text-[11px] font-medium bg-black/55 backdrop-blur border border-white/10 rounded-full px-2.5 py-1">
                                  <span className={`w-1.5 h-1.5 rounded-full ${availability.dot}`} />
                                  <span className={availability.text}>{availability.label}</span>
                                </span>
                              </span>

                              <span className="flex flex-col flex-1 p-5">
                                <span className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                                  {m.category}
                                </span>
                                <span className="block mt-1 text-[17px] font-semibold text-white tracking-tight leading-snug">
                                  {m.name}
                                </span>
                                <span className="flex items-center gap-1.5 mt-1.5 text-[11px] text-zinc-500">
                                  <PinIcon className="w-3 h-3" />
                                  {vendor.district}
                                </span>

                                <span className="block mt-auto pt-5">
                                  <span className="flex items-end justify-between border-t border-white/[0.07] pt-4">
                                    <span className="text-[11px] text-zinc-500 pb-1">za dobę, netto</span>
                                    <span className="text-2xl font-semibold text-white tracking-tight">
                                      {m.daily_rate_net}
                                      <span className="text-sm font-medium text-zinc-400 ml-1">zł</span>
                                    </span>
                                  </span>
                                  <span className="flex justify-between text-[11px] text-zinc-500 mt-2">
                                    <span>Kaucja {m.deposit_amount} zł</span>
                                    <span>Transport {m.transport_rate_per_km} zł/km</span>
                                  </span>
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* KONFIGURATOR */}
                  <aside
                    aria-label="Konfigurator zamówienia"
                    className="lg:col-span-5 lg:sticky lg:top-28 rounded-[2rem] bg-panel border border-white/[0.09] shadow-2xl shadow-black/60 overflow-hidden"
                  >
                    <div className="hazard h-1" />
                    <div className="p-6 sm:p-7">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 font-semibold">
                        Konfigurator zamówienia
                      </span>
                      {selectedMachine && selectedVendor ? (
                        <div className="mt-2 flex items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <h2 className="text-xl font-semibold text-white tracking-tight leading-snug">
                              {selectedMachine.name}
                            </h2>
                            <p className="mt-1 text-xs text-zinc-400">
                              {selectedVendor.name}{" "}
                              <span className="text-brand font-medium ml-1">{selectedVendor.rating}</span>
                            </p>
                          </div>
                          <MachineGlyph
                            category={selectedMachine.category}
                            className="w-20 h-14 text-brand shrink-0"
                          />
                        </div>
                      ) : (
                        <h2 className="mt-2 text-xl font-semibold text-white">Wybierz maszynę</h2>
                      )}

                      {selectedMachine ? (
                        <form onSubmit={handleBooking} className="mt-6 space-y-4">
                          <div className="rounded-2xl bg-black/40 border border-white/[0.07] p-4 space-y-3">
                            <label className="block">
                              <span className="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-1.5">
                                <CalendarIcon className="w-3.5 h-3.5" /> Data rozpoczęcia
                              </span>
                              <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className={`${inputCls} rounded-xl`}
                                required
                              />
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                              <label className="block">
                                <span className="block text-[11px] text-zinc-400 mb-1.5">Godzina od</span>
                                <input
                                  type="time"
                                  value={startHour}
                                  onChange={(e) => setStartHour(e.target.value)}
                                  className={`${inputCls} rounded-xl`}
                                  required
                                />
                              </label>
                              <label className="block">
                                <span className="block text-[11px] text-zinc-400 mb-1.5">Godzina do</span>
                                <input
                                  type="time"
                                  value={endHour}
                                  onChange={(e) => setEndHour(e.target.value)}
                                  className={`${inputCls} rounded-xl`}
                                  required
                                />
                              </label>
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            <ToggleRow
                              checked={withOperator}
                              onChange={setWithOperator}
                              icon={<HardHatIcon className="w-5 h-5" />}
                              title={t(locale, "withOperator")}
                              subtitle={t(locale, "withOperatorSub")}
                              price={`${quote?.operator_hourly_rate ?? "…"} zł/h`}
                            />
                            <ToggleRow
                              checked={withTransport}
                              onChange={setWithTransport}
                              icon={<TruckIcon className="w-5 h-5" />}
                              title={t(locale, "withTransport")}
                              subtitle={t(locale, "withTransportSub")}
                              price={`${selectedMachine.transport_rate_per_km} zł/km`}
                            />
                          </div>

                          {withTransport && (
                            <div className="space-y-2.5 animate-fade-in">
                              <label className="block">
                                <span className="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-1.5">
                                  <PinIcon className="w-3.5 h-3.5" /> {t(locale, "sitePreset")}
                                </span>
                                <select
                                  value={siteId}
                                  onChange={(e) => {
                                    const preset = SITE_PRESETS.find((s) => s.id === e.target.value);
                                    if (!preset) return;
                                    setSiteId(preset.id);
                                    setAddress(preset.address);
                                    setDeliveryLat(preset.lat);
                                    setDeliveryLng(preset.lng);
                                  }}
                                  className={`${inputCls} rounded-2xl`}
                                >
                                  {SITE_PRESETS.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block">
                                <span className="block text-[11px] text-zinc-400 mb-1.5">
                                  {t(locale, "siteLocation")}
                                </span>
                                <input
                                  type="text"
                                  value={address}
                                  onChange={(e) => setAddress(e.target.value)}
                                  className={`${inputCls} rounded-2xl`}
                                  required
                                />
                              </label>
                              {selectedMachine?.base_lat != null &&
                                selectedMachine?.base_lng != null && (
                                  <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-black/30">
                                    <iframe
                                      title="OpenStreetMap delivery"
                                      className="w-full h-40 border-0 grayscale-[20%]"
                                      loading="lazy"
                                      referrerPolicy="no-referrer-when-downgrade"
                                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(selectedMachine.base_lng, deliveryLng) - 0.08}%2C${Math.min(selectedMachine.base_lat, deliveryLat) - 0.05}%2C${Math.max(selectedMachine.base_lng, deliveryLng) + 0.08}%2C${Math.max(selectedMachine.base_lat, deliveryLat) + 0.05}&layer=mapnik&marker=${deliveryLat}%2C${deliveryLng}`}
                                    />
                                    <p className="px-3 py-2 text-[10px] text-zinc-500">
                                      {t(locale, "mapCaption")}
                                    </p>
                                  </div>
                                )}
                            </div>
                          )}

                          <div className="rounded-2xl bg-black/40 border border-white/[0.07] p-5 space-y-2.5 text-[13px]">
                            <div className="flex justify-between text-zinc-400">
                              <span>
                                {t(locale, "machineRent")} ({estimate.days} {t(locale, "day")})
                              </span>
                              <span className="text-zinc-200 tabular-nums">{money(estimate.machineCost)}</span>
                            </div>
                            <div className="flex justify-between text-zinc-400">
                              <span>
                                {t(locale, "operatorFee")} ({Number(estimate.hours).toFixed(1)} {t(locale, "hoursShort")})
                              </span>
                              <span className="text-zinc-200 tabular-nums">{money(estimate.operatorCost)}</span>
                            </div>
                            <div className="flex justify-between text-zinc-400">
                              <span>{t(locale, "logistics")}</span>
                              <span className="text-zinc-200 tabular-nums">{money(estimate.transportCost)}</span>
                            </div>

                            <div className="pt-3.5 mt-1 border-t border-white/[0.08] flex items-baseline justify-between">
                              <span className="text-sm font-medium text-zinc-300">{t(locale, "netTotal")}</span>
                              <span className="text-3xl font-semibold text-white tracking-tight tabular-nums">
                                {money(estimate.totalNet)}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-zinc-400">
                              <span>{t(locale, "grossTotal")}</span>
                              <span className="font-medium text-zinc-300 tabular-nums">
                                {money(estimate.totalGross)}
                              </span>
                            </div>
                            <div className="flex justify-between text-[11px] text-zinc-500">
                              <span>{t(locale, "deposit")}</span>
                              <span className="tabular-nums">{money(selectedMachine.deposit_amount)}</span>
                            </div>
                          </div>

                          {quoteLoading && (
                              <p className="text-xs text-zinc-500">{t(locale, "quoting")}</p>
                            )}
                            {quote && !quote.available && quote.unavailable_reason && (
                              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                                {quote.unavailable_reason}
                              </p>
                            )}
                            {quote?.distance_km_one_way != null && withTransport && (
                              <p className="text-[11px] text-zinc-500">
                                {t(locale, "distanceOneWay")}: {quote.distance_km_one_way} km
                                {quote.transport_buffer_hours != null && (
                                  <>
                                    {" · "}
                                    {t(locale, "transportBuffer")}: {quote.transport_buffer_hours} h
                                  </>
                                )}
                              </p>
                            )}
                            {withOperator && quote?.assigned_operator_name && (
                              <p className="text-[11px] text-zinc-500">
                                {t(locale, "assignedOperator")}: {quote.assigned_operator_name}
                                {quote.operator_selection_score != null && (
                                  <>
                                    {" · "}
                                    {t(locale, "operatorScore")}: {quote.operator_selection_score}
                                  </>
                                )}
                                {quote.operator_week_load_hours != null && (
                                  <>
                                    {" · "}
                                    {t(locale, "operatorWeekLoad")}: {quote.operator_week_load_hours} h
                                  </>
                                )}
                              </p>
                            )}

                          <button
                            type="submit"
                            disabled={loading}
                            className={`w-full font-semibold py-4 rounded-full text-[15px] transition press disabled:opacity-50 flex items-center justify-center gap-2 ${authUser && selectedAvailability && !selectedAvailability.available
                                ? "bg-panel-3 text-brand-soft border border-brand/30 hover:bg-[#252529]"
                                : "bg-brand hover:bg-brand-soft text-black shadow-lg shadow-brand/20"
                              }`}
                          >
                            {loading ? (
                              <>
                                <SpinnerIcon className="w-4 h-4" /> Weryfikacja dostępności w bazie…
                              </>
                            ) : !authUser ? (
                              t(locale, "loginToBook")
                            ) : selectedAvailability && !selectedAvailability.available ? (
                              t(locale, "occupied")
                            ) : (
                              t(locale, "bookCta")
                            )}
                          </button>
                          <p className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
                            <FileIcon className="w-3.5 h-3.5" />
                            Umowa najmu PDF generowana automatycznie
                          </p>
                        </form>
                      ) : (
                        <p className="mt-6 text-sm text-zinc-400">Ładowanie konfiguratora…</p>
                      )}
                    </div>
                  </aside>
                </div>
              </section>

              {/* MOJE REZERWACJE */}
              <section id="rezerwacje" className="surface rounded-[2rem] p-6 sm:p-8">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-white tracking-tight">Moje rezerwacje i dokumenty</h2>
                    <p className="text-sm text-zinc-400 mt-1">
                      Zamówienia ze wszystkich wypożyczalni wraz z umowami najmu w PDF
                    </p>
                  </div>
                  {authUser && (
                    <span className="text-xs bg-white/[0.06] text-zinc-300 px-3.5 py-1.5 rounded-full font-medium">
                      Zlecenia na koncie: {myBookings.length}
                    </span>
                  )}
                </div>

                {!authUser ? (
                  <div className="rounded-2xl bg-black/40 border border-white/[0.06] p-8 text-center">
                    <p className="text-sm text-zinc-400 max-w-md mx-auto">
                      Zaloguj się, aby zobaczyć historię najmu i pobrać umowy PDF.
                    </p>
                    <button
                      onClick={() => setShowLogin(true)}
                      className="mt-5 bg-white hover:bg-zinc-200 text-black text-sm font-semibold px-6 py-2.5 rounded-full transition press"
                    >
                      Zaloguj się
                    </button>
                  </div>
                ) : myBookings.length === 0 ? (
                  <div className="rounded-2xl bg-black/40 border border-white/[0.06] p-8 text-center text-sm text-zinc-400">
                    Brak aktywnych zleceń dla konta{" "}
                    <strong className="text-white">{authUser.full_name}</strong>.
                  </div>
                ) : (
                  <div className="overflow-x-auto scroll-thin -mx-2 px-2">
                    <table className="w-full min-w-[56rem] text-left text-sm">
                      <thead className="border-b border-white/[0.08] text-zinc-500 text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="pb-3.5 font-medium">Maszyna i dostawca</th>
                          <th className="pb-3.5 font-medium">Termin</th>
                          <th className="pb-3.5 font-medium">Operator UDT</th>
                          <th className="pb-3.5 font-medium">Miejsce dostawy</th>
                          <th className="pb-3.5 font-medium">Wartość netto</th>
                          <th className="pb-3.5 font-medium">Status</th>
                          <th className="pb-3.5 font-medium text-right">Dokumentacja</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {myBookings.map((b) => {
                          const st = statusMeta(b.status);
                          const mObj = machines.find((m) => m.id === b.machine_id);
                          const vObj = mObj ? resolveMachineVendor(mObj) : VENDORS.KUJAWY;
                          return (
                            <tr key={b.id} className="hover:bg-white/[0.025] transition-colors">
                              <td className="py-4 pr-4">
                                <div className="font-medium text-white">{getMachineName(b.machine_id)}</div>
                                <div className="text-[11px] text-zinc-500">{vObj.shortName}</div>
                              </td>
                              <td className="py-4 pr-4 text-zinc-300 text-xs">
                                {new Date(b.start_time).toLocaleString("pl-PL", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                –{" "}
                                {new Date(b.end_time).toLocaleTimeString("pl-PL", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className="py-4 pr-4 text-zinc-300 text-xs">
                                {b.operator_name || <span className="text-zinc-500">Bez operatora</span>}
                              </td>
                              <td className="py-4 pr-4 text-zinc-300 text-xs">{b.delivery_address || "Odbiór z bazy"}</td>
                              <td className="py-4 pr-4 font-semibold text-white tabular-nums">{b.total_price_net} zł</td>
                              <td className="py-4 pr-4">
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${st.cls}`}>
                                  {st.label}
                                </span>
                              </td>
                              <td className="py-4 text-right">
                                <a
                                  href={`${API_URL}/bookings/${b.id}/pdf`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs bg-white/[0.08] hover:bg-white hover:text-black text-white px-3.5 py-1.5 rounded-full font-medium transition press"
                                >
                                  <FileIcon className="w-3.5 h-3.5" />
                                  Umowa PDF
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* =====================================================
            2. PANEL DYSPOZYTORA
        ===================================================== */}
        {activeTab === "dispatcher" && (
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-8">
            <div className="animate-fade-up">
              <span className="text-[11px] uppercase tracking-[0.18em] text-brand font-semibold">Panel firmy</span>
              <h1 className="mt-1.5 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
                Centrum dyspozytorskie
              </h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Przychód netto (aktywny)",
                  value: totalRevenueNet.toFixed(2),
                  unit: "zł",
                  cls: "text-white",
                },
                {
                  label: "Aktywne kontrakty",
                  value: String(activeBookingsCount),
                  unit: `/ ${bookings.length}`,
                  cls: "text-white",
                },
                {
                  label: "Przepracowane motogodziny",
                  value: totalWorkedMth.toFixed(1),
                  unit: "mth",
                  cls: "text-brand",
                },
                {
                  label: "Blokady serwisowe UDT",
                  value: String(blocks.length),
                  unit: "",
                  cls: "text-rose-400",
                },
              ].map((s) => (
                <div key={s.label} className="surface rounded-3xl p-6">
                  <span className="text-xs text-zinc-500 font-medium">{s.label}</span>
                  <div className={`mt-3 text-4xl font-semibold tracking-tight tabular-nums ${s.cls}`}>
                    {s.value}
                    {s.unit && <span className="text-sm font-normal text-zinc-500 ml-1.5">{s.unit}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="surface rounded-[2rem] p-6 sm:p-8">
              <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white tracking-tight">Harmonogram wynajmów</h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    Weryfikacja protokołów mth, dokumentów PDF i statusów zleceń
                  </p>
                </div>

                <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-full">
                  {[
                    { key: "ALL", label: "Wszystkie" },
                    { key: "CONFIRMED", label: "Potwierdzone" },
                    { key: "IN_PROGRESS", label: "W trakcie" },
                    { key: "COMPLETED", label: "Zakończone" },
                    { key: "CANCELLED", label: "Anulowane" },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setStatusFilter(f.key)}
                      className={`shrink-0 text-xs px-3.5 py-1.5 rounded-full transition press ${statusFilter === f.key
                          ? "bg-white text-black font-semibold"
                          : "bg-black/40 text-zinc-400 hover:text-white border border-white/[0.08]"
                        }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto scroll-thin -mx-2 px-2">
                <table className="w-full min-w-[60rem] text-left text-sm">
                  <thead className="border-b border-white/[0.08] text-zinc-500 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="pb-3.5 font-medium">Maszyna</th>
                      <th className="pb-3.5 font-medium">Termin</th>
                      <th className="pb-3.5 font-medium">Lokalizacja</th>
                      <th className="pb-3.5 font-medium">Protokoły mth</th>
                      <th className="pb-3.5 font-medium">Kwota netto</th>
                      <th className="pb-3.5 font-medium">Status</th>
                      <th className="pb-3.5 font-medium text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredBookings.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-sm text-zinc-500">
                          Brak zleceń w wybranym statusie.
                        </td>
                      </tr>
                    )}
                    {filteredBookings.map((b) => {
                      const st = statusMeta(b.status);
                      return (
                        <tr key={b.id} className="hover:bg-white/[0.025] transition-colors">
                          <td className="py-4 pr-4 font-medium text-white">{getMachineName(b.machine_id)}</td>
                          <td className="py-4 pr-4 text-zinc-300 text-xs">
                            {new Date(b.start_time).toLocaleString("pl-PL", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            –{" "}
                            {new Date(b.end_time).toLocaleTimeString("pl-PL", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-4 pr-4 text-zinc-300 text-xs">{b.delivery_address || "Odbiór własny"}</td>
                          <td className="py-4 pr-4 text-xs text-zinc-300">
                            {b.protocols.length === 0 ? (
                              <span className="text-zinc-600">Brak</span>
                            ) : (
                              b.protocols.map((p, idx) => (
                                <div key={idx}>
                                  <span className="text-brand font-medium">{p.protocol_type}:</span>{" "}
                                  {p.engine_hours_reading} mth
                                </div>
                              ))
                            )}
                          </td>
                          <td className="py-4 pr-4 font-semibold text-white tabular-nums">{b.total_price_net} zł</td>
                          <td className="py-4 pr-4">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${st.cls}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <div className="inline-flex flex-wrap justify-end gap-1.5">
                              <a
                                href={`${API_URL}/bookings/${b.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-white/[0.08] text-white hover:bg-white hover:text-black px-3 py-1.5 rounded-full transition press"
                              >
                                PDF
                              </a>
                              {b.status === "CONFIRMED" && (
                                <button
                                  onClick={() => handleStatusChange(b.id, "IN_PROGRESS")}
                                  className="text-xs bg-brand/15 text-brand-soft hover:bg-brand/25 px-3 py-1.5 rounded-full transition press"
                                >
                                  Start
                                </button>
                              )}
                              {(b.status === "CONFIRMED" || b.status === "IN_PROGRESS") && (
                                <>
                                  <button
                                    onClick={() => handleStatusChange(b.id, "COMPLETED")}
                                    className="text-xs bg-sky-400/15 text-sky-300 hover:bg-sky-400/25 px-3 py-1.5 rounded-full transition press"
                                  >
                                    Zakończ
                                  </button>
                                  <button
                                    onClick={() => handleStatusChange(b.id, "CANCELLED")}
                                    className="text-xs bg-rose-400/15 text-rose-300 hover:bg-rose-400/25 px-3 py-1.5 rounded-full transition press"
                                  >
                                    Anuluj
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* FLOTA */}
              <div className="surface rounded-[2rem] p-6 sm:p-8">
                <h3 className="text-lg font-semibold text-white">Dodaj nową maszynę do katalogu</h3>
                <p className="text-sm text-zinc-400 mt-1 mb-6">
                  Wprowadź nową jednostkę do puli dostępnej na platformie Digvo
                </p>

                <form onSubmit={handleCreateMachine} className="grid grid-cols-2 gap-3">
                  <label className="col-span-2 block">
                    <span className="block text-[11px] text-zinc-400 mb-1.5">Model</span>
                    <input
                      type="text"
                      placeholder="np. Minikoparka Bobcat E27"
                      value={newMachineName}
                      onChange={(e) => setNewMachineName(e.target.value)}
                      className={`${inputCls} rounded-2xl`}
                      required
                    />
                  </label>
                  <label className="col-span-2 block">
                    <span className="block text-[11px] text-zinc-400 mb-1.5">Kategoria</span>
                    <input
                      type="text"
                      value={newMachineCategory}
                      onChange={(e) => setNewMachineCategory(e.target.value)}
                      className={`${inputCls} rounded-2xl`}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] text-zinc-400 mb-1.5">Stawka za dobę (zł)</span>
                    <input
                      type="number"
                      value={newMachineRate}
                      onChange={(e) => setNewMachineRate(e.target.value)}
                      className={`${inputCls} rounded-2xl`}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] text-zinc-400 mb-1.5">Kaucja (zł)</span>
                    <input
                      type="number"
                      value={newMachineDeposit}
                      onChange={(e) => setNewMachineDeposit(e.target.value)}
                      className={`${inputCls} rounded-2xl`}
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="col-span-2 mt-1 bg-white hover:bg-zinc-200 text-black font-semibold rounded-full px-5 py-3 text-sm transition press"
                  >
                    Dodaj sprzęt
                  </button>
                </form>
              </div>

              {/* BLOKADY */}
              <div className="surface rounded-[2rem] p-6 sm:p-8">
                <h3 className="text-lg font-semibold text-white">Blokady serwisowe i przeglądy UDT</h3>
                <p className="text-sm text-zinc-400 mt-1 mb-6">
                  Wyłącz maszynę ze sprzedaży na czas przeglądu technicznego lub konserwacji
                </p>

                <form onSubmit={handleCreateBlock} className="grid grid-cols-2 gap-3 mb-6">
                  <label className="col-span-2 block">
                    <span className="block text-[11px] text-zinc-400 mb-1.5">Maszyna</span>
                    <select
                      value={blockMachineId}
                      onChange={(e) => setBlockMachineId(e.target.value)}
                      className={`${inputCls} rounded-2xl`}
                    >
                      {machines.map((m) => (
                        <option key={m.id} value={m.id} className="bg-panel-2">
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-[11px] text-zinc-400 mb-1.5">Data</span>
                    <input
                      type="date"
                      value={blockDate}
                      onChange={(e) => setBlockDate(e.target.value)}
                      className={`${inputCls} rounded-2xl`}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] text-zinc-400 mb-1.5">Powód</span>
                    <select
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      className={`${inputCls} rounded-2xl`}
                    >
                      <option value="MAINTENANCE" className="bg-panel-2">Serwis / przegląd UDT</option>
                      <option value="VACATION" className="bg-panel-2">Postój planowany</option>
                      <option value="SICK_LEAVE" className="bg-panel-2">Niedostępność techniczna</option>
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="col-span-2 mt-1 bg-rose-500/80 hover:bg-rose-500 text-white font-semibold rounded-full px-5 py-3 text-sm transition press"
                  >
                    Zablokuj maszynę
                  </button>
                </form>

                {blocks.length > 0 && (
                  <ul className="space-y-2 max-h-72 overflow-y-auto scroll-thin pr-1">
                    {blocks.map((bl) => (
                      <li
                        key={bl.id}
                        className="flex flex-wrap justify-between items-center gap-3 bg-black/40 border border-white/[0.06] px-4 py-3 rounded-2xl text-sm"
                      >
                        <span className="font-medium text-white">{getMachineName(bl.machine_id)}</span>
                        <span className="text-zinc-400 text-xs">
                          {new Date(bl.start_time).toLocaleDateString("pl-PL")}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="bg-rose-500/15 text-rose-300 px-3 py-0.5 rounded-full text-xs">
                            {bl.reason}
                          </span>
                          <button
                            onClick={() => handleDeleteBlock(bl.id)}
                            className="text-xs text-zinc-400 hover:text-rose-400 underline underline-offset-2 transition"
                          >
                            Usuń
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            3. PANEL OPERATORA (widok mobilny)
        ===================================================== */}
        {activeTab === "operator" && (
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-8">
            <div className="animate-fade-up">
              <span className="text-[11px] uppercase tracking-[0.18em] text-brand font-semibold">Panel operatora</span>
              <h1 className="mt-1.5 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
                Protokoły zdawczo-odbiorcze
              </h1>
              <p className="mt-2 text-sm text-zinc-400 max-w-xl">
                Cyfrowy odczyt licznika motogodzin (mth) przy wydaniu oraz zwrocie sprzętu na budowie.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {bookings
                .filter((b) => b.status !== "CANCELLED")
                .map((b) => {
                  const pickup = b.protocols.find((p) => p.protocol_type === "PICKUP");
                  const ret = b.protocols.find((p) => p.protocol_type === "RETURN");
                  const st = statusMeta(b.status);

                  return (
                    <div key={b.id} className="surface rounded-[2rem] p-6 space-y-5 card-lift hover:border-white/[0.16]">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-lg text-white tracking-tight leading-snug">
                            {getMachineName(b.machine_id)}
                          </h3>
                          <p className="flex items-center gap-1.5 text-xs text-zinc-400 mt-1">
                            <PinIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">
                              {b.delivery_address || "Baza Bydgoszcz"} ·{" "}
                              {new Date(b.start_time).toLocaleDateString("pl-PL")}
                            </span>
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-px bg-white/[0.07] rounded-2xl overflow-hidden border border-white/[0.07] text-xs">
                        <div className="bg-black/50 p-4">
                          <span className="text-zinc-500 block mb-1">Wydanie (PICKUP)</span>
                          <span className="font-semibold text-emerald-400 text-lg tabular-nums">
                            {pickup ? `${pickup.engine_hours_reading} mth` : "Oczekuje"}
                          </span>
                        </div>
                        <div className="bg-black/50 p-4">
                          <span className="text-zinc-500 block mb-1">Zwrot (RETURN)</span>
                          <span className="font-semibold text-sky-400 text-lg tabular-nums">
                            {ret ? `${ret.engine_hours_reading} mth` : "Oczekuje"}
                          </span>
                        </div>
                      </div>

                      {(!pickup || !ret) && (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.1"
                            inputMode="decimal"
                            placeholder="Odczyt licznika (mth)"
                            value={mthInputs[b.id] || ""}
                            onChange={(e) => setMthInputs((prev) => ({ ...prev, [b.id]: e.target.value }))}
                            className={`${inputCls} flex-1 min-w-0 rounded-full px-5`}
                          />
                          {!pickup ? (
                            <button
                              onClick={() => handleHandover(b.id, "PICKUP")}
                              className="bg-brand hover:bg-brand-soft text-black font-semibold px-5 py-3 rounded-full text-xs transition press whitespace-nowrap"
                            >
                              Zapisz PICKUP
                            </button>
                          ) : (
                            <button
                              onClick={() => handleHandover(b.id, "RETURN")}
                              className="bg-white hover:bg-zinc-200 text-black font-semibold px-5 py-3 rounded-full text-xs transition press whitespace-nowrap"
                            >
                              Zapisz RETURN
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </main>

      {/* ===== STOPKA ===== */}
      <footer className="mt-10 border-t border-white/[0.06]">
        <div className="hazard h-1 opacity-80" />
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-white text-black font-bold text-[11px] flex items-center justify-center">
              D
            </span>
            Digvo · Equipment Cloud
          </span>
          <span>© 2026 Digvo. Wynajem sprzętu budowlanego z operatorem i transportem.</span>
        </div>
      </footer>

      <LoginModal
        open={showLogin}
        onClose={closeLogin}
        accounts={DEMO_ACCOUNTS}
        error={loginError}
        onClearError={clearLoginError}
        onLogin={performLogin}
        onRegister={performRegister}
        onQuickLogin={handleQuickAccountSelect}
      />
    </div>
  );
}

/* ---------- Komponenty pomocnicze ---------- */

const inputCls =
  "w-full bg-panel-2 border border-white/[0.1] focus:border-brand/70 hover:border-white/[0.18] outline-none px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 transition";

const ROLE_LABEL: Record<string, string> = {
  CLIENT: "Klient",
  DISPATCHER: "Dyspozytor floty",
  OPERATOR: "Operator UDT",
  ADMIN: "Administrator",
};

function ToggleRow({
  checked,
  onChange,
  icon,
  title,
  subtitle,
  price,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  price: string;
}) {
  return (
    <label
      className={`flex items-center gap-3.5 p-4 rounded-2xl border cursor-pointer transition ${checked ? "bg-brand/[0.06] border-brand/35" : "bg-black/40 border-white/[0.08] hover:border-white/[0.18]"
        }`}
    >
      <span
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition ${checked ? "bg-brand text-black" : "bg-white/[0.06] text-zinc-400"
          }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-white leading-snug">{title}</span>
        <span className="block text-[11px] text-zinc-500 mt-0.5">{subtitle}</span>
        <span className="block text-xs font-medium text-zinc-300 mt-1">{price}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative w-[3.1rem] h-7 rounded-full bg-zinc-700 peer-checked:bg-brand transition-colors shrink-0 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-6 after:h-6 after:rounded-full after:bg-white after:shadow-md after:transition-transform after:duration-200 peer-checked:after:translate-x-[1.2rem] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand"
      />
    </label>
  );
}
