"use client";

import { useEffect, useMemo, useState } from "react";

interface Machine {
  id: string;
  organization_id?: string;
  organization_name?: string;
  name: string;
  category: string;
  daily_rate_net: number;
  deposit_amount: number;
  transport_rate_per_km: number;
  service_buffer_hours: number;
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
  GRASER: {
    id: "GRASER",
    name: "Graser Maszyny Budowlane Sp. z o.o.",
    shortName: "Graser Bydgoszcz",
    district: "Bydgoszcz • Fordon / Przemysłowa",
    rating: "4.9 ★",
    badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  RAMIRENT: {
    id: "RAMIRENT",
    name: "Ramirent S.A. — Oddział Bydgoszcz",
    shortName: "Ramirent Bydgoszcz",
    district: "Bydgoszcz • ul. Przemysłowa",
    rating: "4.8 ★",
    badgeColor: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  },
  CRAMO: {
    id: "CRAMO",
    name: "Cramo Polska — Baza Białe Błota",
    shortName: "Cramo Białe Błota",
    district: "Białe Błota k. Bydgoszczy",
    rating: "4.9 ★",
    badgeColor: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  },
};

function resolveMachineVendor(machine: Machine): VendorInfo {
  if (machine.organization_name) {
    if (machine.organization_name.toLowerCase().includes("ramirent")) return VENDORS.RAMIRENT;
    if (machine.organization_name.toLowerCase().includes("cramo")) return VENDORS.CRAMO;
    return VENDORS.GRASER;
  }
  const n = machine.name.toLowerCase();
  if (n.includes("volvo") || n.includes("428f2") || n.includes("liebherr")) {
    return VENDORS.RAMIRENT;
  }
  if (n.includes("kubota") || n.includes("manitou")) {
    return VENDORS.CRAMO;
  }
  return VENDORS.GRASER;
}

const DEMO_ACCOUNTS = [
  { label: "Klient B2B: PW Lech Budownictwo (Bydgoszcz)", email: "zamowienia@pwlech-bydgoszcz.pl", role: "CLIENT" },
  { label: "Klient B2B: Ebud-Przemysłówka S.A. (BPPT)", email: "logistyka@ebud-bydgoszcz.pl", role: "CLIENT" },
  { label: "Klient B2B: KPPRD Inżynieria Drogowa", email: "sprzet@kpprd.pl", role: "CLIENT" },
  { label: "Klient B2B: Aqua-Instal Fordon", email: "biuro@aquainstal-fordon.pl", role: "CLIENT" },
  { label: "Klient: Tomasz Zieliński (Inwestor Fordon)", email: "inwestor@budowa-fordon.pl", role: "CLIENT" },
  { label: "Dyspozytor Floty: Marek Wiśniewski", email: "dyspozytor@graser-bydgoszcz.pl", role: "DISPATCHER" },
  { label: "Operator UDT: Jan Kowalski", email: "j.kowalski@graser-bydgoszcz.pl", role: "OPERATOR" },
  { label: "Operator UDT: Piotr Nowak", email: "p.nowak@graser-bydgoszcz.pl", role: "OPERATOR" },
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
  const [email, setEmail] = useState("zamowienia@pwlech-bydgoszcz.pl");
  const [password, setPassword] = useState("haslo123");

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

  // Konfigurator wynajmu
  const [date, setDate] = useState("2026-11-26");
  const [startHour, setStartHour] = useState("08:00");
  const [endHour, setEndHour] = useState("16:00");
  const [withOperator, setWithOperator] = useState(true);
  const [withTransport, setWithTransport] = useState(true);
  const [address, setAddress] = useState("ul. Fordońska 40, Bydgoszcz");

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

  const performLogin = async (targetEmail: string, targetPassword: string) => {
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: formatApiError(data.detail, "Błąd logowania.") });
        return;
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
      setMessage({ type: "success", text: `Zalogowano jako ${data.full_name}` });
    } catch {
      setMessage({ type: "error", text: "Błąd połączenia z serwerem autoryzacji." });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(email, password);
  };

  const handleQuickAccountSelect = async (selectedEmail: string) => {
    if (!selectedEmail) return;
    setEmail(selectedEmail);
    setPassword("haslo123");
    await performLogin(selectedEmail, "haslo123");
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthUser(null);
    setMyBookings([]);
    setActiveTab("client");
    setMessage({ type: "success", text: "Wylogowano z konta." });
  };

  const authHeaders = () => ({
    "Content-Type": "application/json",
    ...(authUser ? { Authorization: `Bearer ${authUser.token}` } : {}),
  });

  const calculateEstimate = () => {
    if (!selectedMachine) {
      return { hours: 0, days: 1, machineCost: 0, operatorCost: 0, transportCost: 0, totalNet: 0, totalGross: 0 };
    }
    const [sh, sm] = startHour.split(":").map(Number);
    const [eh, em] = endHour.split(":").map(Number);
    const hours = Math.max(0, eh + em / 60 - (sh + sm / 60));
    const days = Math.max(1, Math.ceil(hours / 24));

    const machineCost = days * selectedMachine.daily_rate_net;
    const operatorCost = withOperator ? hours * 65 : 0;
    const transportCost = withTransport ? 3.1 * 2 * selectedMachine.transport_rate_per_km : 0;
    const totalNet = machineCost + operatorCost + transportCost;
    const totalGross = totalNet * 1.23;

    return {
      hours: Number(hours.toFixed(1)),
      days,
      machineCost: Number(machineCost.toFixed(2)),
      operatorCost: Number(operatorCost.toFixed(2)),
      transportCost: Number(transportCost.toFixed(2)),
      totalNet: Number(totalNet.toFixed(2)),
      totalGross: Number(totalGross.toFixed(2)),
    };
  };

  const estimate = calculateEstimate();

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachine) return;
    if (!authUser) {
      setMessage({ type: "error", text: "Wybierz konto firmowe z górnego paska, aby złożyć rezerwację." });
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
          start_time: `${date}T${startHour}:00Z`,
          end_time: `${date}T${endHour}:00Z`,
          with_operator: withOperator,
          with_transport: withTransport,
          delivery_address: withTransport ? address : null,
          delivery_lat: 53.126,
          delivery_lng: 18.045,
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
          start_time: `${blockDate}T00:00:00Z`,
          end_time: `${blockDate}T23:59:00Z`,
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

    const reqStart = new Date(`${date}T${startHour}:00Z`).getTime();
    const reqEnd = new Date(`${date}T${endHour}:00Z`).getTime();
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

  return (
    <div className="min-h-screen bg-[#000000] text-[#F5F5F7] font-sans antialiased selection:bg-amber-400 selection:text-black">
      {/* APPLE-STYLE GLASS NAVIGATION BAR */}
      <header className="sticky top-0 z-30 bg-[#000000]/80 backdrop-blur-2xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-white text-black font-bold flex items-center justify-center text-base tracking-tighter">
              D
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="text-lg font-semibold tracking-tight text-white">Digvo</span>
              <span className="text-xs text-zinc-400 hidden sm:inline">
                Equipment Cloud • Bydgoszcz
              </span>
            </div>
          </div>

          <nav className="flex items-center bg-[#141416] border border-white/[0.08] p-1 rounded-full">
            <button
              onClick={() => setActiveTab("client")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                activeTab === "client"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Marketplace
            </button>
            <button
              onClick={() => setActiveTab("dispatcher")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                activeTab === "dispatcher"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span>Dyspozytor</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === "dispatcher" ? "bg-black/15 text-black" : "bg-white/[0.08] text-zinc-300"
                }`}
              >
                {bookings.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("operator")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                activeTab === "operator"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Operator
            </button>
          </nav>
        </div>

        {/* SUB-NAVBAR: SZYBKIE PRZEŁĄCZANIE FIRM B2B */}
        <div className="border-t border-white/[0.06] bg-[#09090B]/90">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            {authUser ? (
              <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="text-zinc-400">
                    Konto: <strong className="text-white font-medium">{authUser.full_name}</strong>
                  </span>
                  <span className="text-[11px] bg-white/[0.07] text-zinc-300 px-2 py-0.5 rounded-md font-medium">
                    {authUser.role}
                  </span>
                </div>

                <div className="flex items-center gap-3 ml-auto">
                  <select
                    aria-label="Przełącz firmę lub rolę"
                    value=""
                    onChange={(e) => handleQuickAccountSelect(e.target.value)}
                    className="bg-[#141416] border border-white/[0.1] hover:border-white/[0.2] rounded-full px-3.5 py-1 text-zinc-200 text-xs outline-none cursor-pointer transition"
                  >
                    <option value="" disabled>
                      Przełącz firmę / rolę...
                    </option>
                    {DEMO_ACCOUNTS.map((acc) => (
                      <option key={acc.email} value={acc.email} className="bg-[#141416]">
                        {acc.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleLogout}
                    className="text-zinc-400 hover:text-white px-2.5 py-1 rounded-full transition"
                  >
                    Wyloguj
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                <form onSubmit={handleLogin} className="flex flex-wrap items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E-mail firmowy"
                    className="bg-[#141416] border border-white/[0.1] focus:border-white/[0.3] outline-none rounded-full px-3.5 py-1 text-zinc-200 w-52 text-xs transition"
                    required
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Hasło"
                    className="bg-[#141416] border border-white/[0.1] focus:border-white/[0.3] outline-none rounded-full px-3.5 py-1 text-zinc-200 w-24 text-xs transition"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-white hover:bg-zinc-200 text-black font-semibold px-4 py-1 rounded-full transition"
                  >
                    Zaloguj
                  </button>
                </form>

                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-zinc-500 hidden sm:inline">Szybki dostęp B2B:</span>
                  <select
                    aria-label="Wybierz firmę B2B"
                    defaultValue=""
                    onChange={(e) => handleQuickAccountSelect(e.target.value)}
                    className="bg-[#141416] border border-white/[0.12] hover:border-white/[0.25] rounded-full px-3.5 py-1 text-zinc-200 text-xs font-medium outline-none cursor-pointer transition"
                  >
                    <option value="" disabled>
                      Wybierz firmę z regionu (1 kliknięcie)...
                    </option>
                    {DEMO_ACCOUNTS.map((acc) => (
                      <option key={acc.email} value={acc.email} className="bg-[#141416] text-white">
                        {acc.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
        {message && (
          <div
            className={`mb-8 px-5 py-3.5 rounded-2xl border backdrop-blur-xl flex items-center justify-between gap-4 transition-all ${
              message.type === "success"
                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-200"
                : "bg-rose-950/40 border-rose-500/30 text-rose-200"
            }`}
          >
            <span className="text-sm">{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="text-xs text-zinc-400 hover:text-white px-2 py-1"
            >
              Zamknij
            </button>
          </div>
        )}

        {/* 1. MARKETPLACE B2B (WIDOK KLIENTA) */}
        {activeTab === "client" && (
          <div className="space-y-14">
            {/* HERO SECTION INSPIRATION APPLE */}
            <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-white/[0.08]">
              <div className="space-y-2 max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
                  Bydgoszcz & Kujawsko-Pomorskie
                </p>
                <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-white leading-[1.1]">
                  Wynajem maszyn.{" "}
                  <span className="text-zinc-500">Od najlepszych dostawców w regionie.</span>
                </h1>
                <p className="text-sm sm:text-base text-zinc-400 pt-1 leading-relaxed">
                  Porównuj dostępność i stawki w czasie rzeczywistym u zweryfikowanych partnerów:
                  Graser, Ramirent oraz Cramo. Rezerwacja z operatorem UDT i umową PDF w 30 sekund.
                </p>
              </div>

              <div className="flex items-center gap-6 text-xs text-zinc-400 shrink-0">
                <div>
                  <span className="block text-2xl font-semibold text-white">{machines.length}</span>
                  <span>Maszyn w bazie</span>
                </div>
                <div className="h-8 w-px bg-white/[0.1]" />
                <div>
                  <span className="block text-2xl font-semibold text-white">3</span>
                  <span>Oddziały w Bydgoszczy</span>
                </div>
                <div className="h-8 w-px bg-white/[0.1]" />
                <div>
                  <span className="block text-2xl font-semibold text-emerald-400">100%</span>
                  <span>Przeglądy UDT</span>
                </div>
              </div>
            </section>

            {/* FILTRY DOSTAWCÓW (WYPOŻYCZALNI) */}
            <section className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setVendorFilter("ALL")}
                    className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                      vendorFilter === "ALL"
                        ? "bg-white text-black font-semibold"
                        : "bg-[#141416] text-zinc-300 border border-white/[0.08] hover:border-white/[0.2]"
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
                        className={`px-4 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-2 ${
                          vendorFilter === v.id
                            ? "bg-white text-black font-semibold"
                            : "bg-[#141416] text-zinc-300 border border-white/[0.08] hover:border-white/[0.2]"
                        }`}
                      >
                        <span>{v.shortName}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            vendorFilter === v.id ? "bg-black/15 text-black" : "bg-white/[0.08] text-zinc-400"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Szukaj modelu, marki lub dostawcy..."
                  className="bg-[#141416] border border-white/[0.1] focus:border-white/[0.3] outline-none rounded-full px-4 py-2 text-xs text-white placeholder:text-zinc-500 w-full md:w-72 transition"
                />
              </div>

              {/* FILTRY KATEGORII */}
              <div className="flex flex-wrap items-center gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium transition ${
                      categoryFilter === cat
                        ? "bg-amber-400/15 text-amber-300 border border-amber-400/30"
                        : "text-zinc-400 hover:text-zinc-200 bg-white/[0.03] border border-transparent"
                    }`}
                  >
                    {cat === "ALL" ? "Wszystkie kategorie" : cat}
                  </button>
                ))}
              </div>
            </section>

            {/* GŁÓWNA SIATKA: KATALOG + KONFIGURATOR */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEWA KOLUMNA: KARTY MASZYN (7/12) */}
              <div className="lg:col-span-7 space-y-4">
                {initialLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        className="h-52 rounded-3xl bg-[#141416] border border-white/[0.06] animate-pulse p-6"
                      />
                    ))}
                  </div>
                ) : filteredMachines.length === 0 ? (
                  <div className="bg-[#141416] border border-white/[0.08] rounded-3xl p-10 text-center text-sm text-zinc-400">
                    Brak maszyn spełniających wybrane kryteria filtrowania.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredMachines.map((m) => {
                      const isSelected = selectedMachine?.id === m.id;
                      const availability = getMachineAvailability(m);
                      const vendor = resolveMachineVendor(m);

                      return (
                        <div
                          key={m.id}
                          onClick={() => setSelectedMachine(m)}
                          className={`group cursor-pointer rounded-3xl p-6 transition-all duration-200 flex flex-col justify-between ${
                            isSelected
                              ? "bg-[#1C1C1F] border-2 border-amber-400 shadow-2xl shadow-amber-500/10"
                              : "bg-[#121214] border border-white/[0.08] hover:border-white/[0.2] hover:bg-[#161618]"
                          }`}
                        >
                          <div>
                            {/* Górny pasek: Dostawca + Status */}
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <span
                                className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${vendor.badgeColor}`}
                              >
                                {vendor.shortName}
                              </span>
                              <div className="flex items-center gap-1.5 text-[11px] font-medium">
                                <span className={`w-1.5 h-1.5 rounded-full ${availability.dot}`} />
                                <span className={availability.text}>{availability.label}</span>
                              </div>
                            </div>

                            <p className="text-[11px] text-zinc-500 font-medium">{m.category}</p>
                            <h3 className="text-lg font-semibold text-white tracking-tight mt-0.5 leading-snug group-hover:text-amber-300 transition-colors">
                              {m.name}
                            </h3>
                            <p className="text-[11px] text-zinc-500 mt-1">{vendor.district}</p>
                          </div>

                          <div className="mt-6 pt-4 border-t border-white/[0.07]">
                            <div className="flex items-baseline justify-between">
                              <span className="text-xs text-zinc-400">Cena za dobę</span>
                              <div>
                                <span className="text-xl font-semibold text-white tracking-tight">
                                  {m.daily_rate_net} zł
                                </span>
                                <span className="text-[11px] text-zinc-500 ml-1">netto</span>
                              </div>
                            </div>
                            <div className="flex justify-between text-[11px] text-zinc-500 mt-1.5">
                              <span>Kaucja: {m.deposit_amount} zł</span>
                              <span>Transport: {m.transport_rate_per_km} zł/km</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* PRAWA KOLUMNA: KONFIGURATOR APPLE-STYLE (5/12) */}
              <div className="lg:col-span-5 bg-[#121214] border border-white/[0.09] rounded-3xl p-7 lg:sticky lg:top-28 shadow-2xl shadow-black/50">
                <div className="mb-5">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                    Konfigurator zamówienia
                  </span>
                  {selectedMachine && selectedVendor ? (
                    <div className="mt-1">
                      <h2 className="text-xl font-semibold text-white tracking-tight">
                        {selectedMachine.name}
                      </h2>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="text-xs text-zinc-400">
                          Dostawca: <strong className="text-zinc-200">{selectedVendor.name}</strong>
                        </span>
                        <span className="text-[11px] text-amber-400 font-medium">
                          {selectedVendor.rating}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <h2 className="text-xl font-semibold text-white mt-1">Wybierz maszynę</h2>
                  )}
                </div>

                {selectedMachine ? (
                  <form onSubmit={handleBooking} className="space-y-4">
                    <div className="bg-[#09090B] border border-white/[0.08] rounded-2xl p-4 space-y-3">
                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1">Data rozpoczęcia</label>
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full bg-[#141416] border border-white/[0.1] focus:border-white/[0.3] outline-none rounded-xl px-3.5 py-2 text-sm text-white"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Godzina od</label>
                          <input
                            type="time"
                            value={startHour}
                            onChange={(e) => setStartHour(e.target.value)}
                            className="w-full bg-[#141416] border border-white/[0.1] focus:border-white/[0.3] outline-none rounded-xl px-3.5 py-2 text-sm text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Godzina do</label>
                          <input
                            type="time"
                            value={endHour}
                            onChange={(e) => setEndHour(e.target.value)}
                            className="w-full bg-[#141416] border border-white/[0.1] focus:border-white/[0.3] outline-none rounded-xl px-3.5 py-2 text-sm text-white"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <label className="flex items-center justify-between p-4 bg-[#09090B] rounded-2xl border border-white/[0.08] hover:border-white/[0.18] cursor-pointer transition">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={withOperator}
                            onChange={(e) => setWithOperator(e.target.checked)}
                            className="accent-amber-400 w-4 h-4 rounded"
                          />
                          <div>
                            <span className="text-sm font-medium text-white block">
                              Operator z uprawnieniami UDT
                            </span>
                            <span className="text-[11px] text-zinc-500">
                              Certyfikowany operator z bazy dostawcy
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-zinc-300">65 zł/h</span>
                      </label>

                      <label className="flex items-center justify-between p-4 bg-[#09090B] rounded-2xl border border-white/[0.08] hover:border-white/[0.18] cursor-pointer transition">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={withTransport}
                            onChange={(e) => setWithTransport(e.target.checked)}
                            className="accent-amber-400 w-4 h-4 rounded"
                          />
                          <div>
                            <span className="text-sm font-medium text-white block">
                              Transport niskopodwoziowy
                            </span>
                            <span className="text-[11px] text-zinc-500">
                              Dostawa na budowę i odbiór sprzętu
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-zinc-300">
                          {selectedMachine.transport_rate_per_km} zł/km
                        </span>
                      </label>
                    </div>

                    {withTransport && (
                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1">
                          Lokalizacja placu budowy
                        </label>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full bg-[#09090B] border border-white/[0.1] focus:border-white/[0.3] outline-none rounded-2xl px-4 py-2.5 text-sm text-white"
                          required
                        />
                      </div>
                    )}

                    {/* PODSUMOWANIE FINANSOWE */}
                    <div className="p-5 bg-[#09090B] rounded-2xl border border-white/[0.08] space-y-2 text-xs">
                      <div className="flex justify-between text-zinc-400">
                        <span>Wynajem maszyny ({estimate.days} doba)</span>
                        <span className="text-zinc-200">{estimate.machineCost.toFixed(2)} zł</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>Obsługa operatorska ({estimate.hours}h)</span>
                        <span className="text-zinc-200">{estimate.operatorCost.toFixed(2)} zł</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>Logistyka (w obie strony)</span>
                        <span className="text-zinc-200">{estimate.transportCost.toFixed(2)} zł</span>
                      </div>

                      <div className="pt-3 mt-2 border-t border-white/[0.08] flex items-baseline justify-between">
                        <span className="text-sm font-medium text-zinc-300">Suma netto</span>
                        <span className="text-2xl font-semibold text-white tracking-tight">
                          {estimate.totalNet.toFixed(2)} zł
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>Suma brutto (z 23% VAT)</span>
                        <span className="font-medium text-zinc-300">{estimate.totalGross.toFixed(2)} zł</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-zinc-500 pt-1">
                        <span>Zwrotna kaucja zabezpieczająca</span>
                        <span>{selectedMachine.deposit_amount} zł</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className={`w-full font-semibold py-3.5 rounded-full text-sm transition-all duration-200 disabled:opacity-50 ${
                        selectedAvailability && !selectedAvailability.available
                          ? "bg-[#1C1C1F] text-amber-300 border border-amber-400/30 hover:bg-[#252529]"
                          : "bg-amber-400 hover:bg-amber-300 text-black shadow-lg shadow-amber-400/15"
                      }`}
                    >
                      {loading
                        ? "Weryfikacja dostępności w bazie..."
                        : selectedAvailability && !selectedAvailability.available
                        ? "Termin zajęty — sprawdź inny dzień"
                        : "Zarezerwuj i wygeneruj umowę"}
                    </button>
                  </form>
                ) : (
                  <p className="text-sm text-zinc-400">Ładowanie konfiguratora...</p>
                )}
              </div>
            </div>

            {/* MOJE REZERWACJE I DOKUMENTY PDF */}
            <section className="bg-[#121214] border border-white/[0.08] rounded-3xl p-7">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-white tracking-tight">
                    Moje rezerwacje i dokumenty
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Zestawienie zamówień z wszystkich wypożyczalni wraz z wygenerowanymi umowami najmu PDF
                  </p>
                </div>
                {authUser && (
                  <span className="text-xs bg-white/[0.06] text-zinc-300 px-3.5 py-1.5 rounded-full font-medium">
                    Zlecenia na koncie: {myBookings.length}
                  </span>
                )}
              </div>

              {!authUser ? (
                <div className="text-sm text-zinc-400 bg-[#09090B] border border-white/[0.06] rounded-2xl p-6">
                  Wybierz konto firmowe w górnym pasku (<strong className="text-zinc-200">Szybki dostęp B2B</strong>), aby wyświetlić historię najmu i pobrać umowy PDF.
                </div>
              ) : myBookings.length === 0 ? (
                <div className="text-sm text-zinc-400 bg-[#09090B] border border-white/[0.06] rounded-2xl p-6">
                  Brak aktywnych zleceń dla konta <strong className="text-white">{authUser.full_name}</strong>.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/[0.08] text-zinc-500 text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="pb-3.5">Maszyna i dostawca</th>
                        <th className="pb-3.5">Termin</th>
                        <th className="pb-3.5">Operator UDT</th>
                        <th className="pb-3.5">Miejsce dostawy</th>
                        <th className="pb-3.5">Wartość netto</th>
                        <th className="pb-3.5">Status</th>
                        <th className="pb-3.5 text-right">Dokumentacja</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {myBookings.map((b) => {
                        const st = statusMeta(b.status);
                        const mObj = machines.find((m) => m.id === b.machine_id);
                        const vObj = mObj ? resolveMachineVendor(mObj) : VENDORS.GRASER;
                        return (
                          <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-4">
                              <div className="font-medium text-white">{getMachineName(b.machine_id)}</div>
                              <div className="text-[11px] text-zinc-500">{vObj.shortName}</div>
                            </td>
                            <td className="py-4 text-zinc-300 text-xs">
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
                            <td className="py-4 text-zinc-300 text-xs">
                              {b.operator_name || <span className="text-zinc-500">Bez operatora</span>}
                            </td>
                            <td className="py-4 text-zinc-300 text-xs">
                              {b.delivery_address || "Odbiór z bazy"}
                            </td>
                            <td className="py-4 font-semibold text-white">
                              {b.total_price_net} zł
                            </td>
                            <td className="py-4">
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${st.cls}`}>
                                {st.label}
                              </span>
                            </td>
                            <td className="py-4 text-right">
                              <a
                                href={`${API_URL}/bookings/${b.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-white/[0.08] hover:bg-white hover:text-black text-white px-3.5 py-1.5 rounded-full font-medium inline-block transition"
                              >
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
        )}

        {/* 2. PANEL DYSPOZYTORA */}
        {activeTab === "dispatcher" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#121214] border border-white/[0.08] rounded-3xl p-6">
                <span className="text-xs text-zinc-500 font-medium">Przychód netto (aktywny)</span>
                <div className="text-3xl font-semibold text-white tracking-tight mt-2">
                  {totalRevenueNet.toFixed(2)} <span className="text-sm font-normal text-zinc-400">zł</span>
                </div>
              </div>
              <div className="bg-[#121214] border border-white/[0.08] rounded-3xl p-6">
                <span className="text-xs text-zinc-500 font-medium">Aktywne kontrakty</span>
                <div className="text-3xl font-semibold text-white tracking-tight mt-2">
                  {activeBookingsCount}{" "}
                  <span className="text-sm font-normal text-zinc-500">/ {bookings.length}</span>
                </div>
              </div>
              <div className="bg-[#121214] border border-white/[0.08] rounded-3xl p-6">
                <span className="text-xs text-zinc-500 font-medium">Przepracowane motogodziny</span>
                <div className="text-3xl font-semibold text-amber-400 tracking-tight mt-2">
                  {totalWorkedMth.toFixed(1)} <span className="text-sm font-normal text-zinc-400">mth</span>
                </div>
              </div>
              <div className="bg-[#121214] border border-white/[0.08] rounded-3xl p-6">
                <span className="text-xs text-zinc-500 font-medium">Blokady serwisowe UDT</span>
                <div className="text-3xl font-semibold text-rose-400 tracking-tight mt-2">
                  {blocks.length}
                </div>
              </div>
            </div>

            <div className="bg-[#121214] border border-white/[0.08] rounded-3xl p-7">
              <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white tracking-tight">
                    Centrum dyspozytorskie
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Harmonogram wynajmów, weryfikacja protokołów mth i dokumentów PDF
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
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
                      className={`text-xs px-3.5 py-1.5 rounded-full transition ${
                        statusFilter === f.key
                          ? "bg-white text-black font-semibold"
                          : "bg-[#09090B] text-zinc-400 hover:text-white border border-white/[0.08]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/[0.08] text-zinc-500 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="pb-3.5">Maszyna</th>
                      <th className="pb-3.5">Termin</th>
                      <th className="pb-3.5">Lokalizacja</th>
                      <th className="pb-3.5">Protokoły mth</th>
                      <th className="pb-3.5">Kwota netto</th>
                      <th className="pb-3.5">Status</th>
                      <th className="pb-3.5 text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredBookings.map((b) => {
                      const st = statusMeta(b.status);
                      return (
                        <tr key={b.id} className="hover:bg-white/[0.02]">
                          <td className="py-4 font-medium text-white">
                            {getMachineName(b.machine_id)}
                          </td>
                          <td className="py-4 text-zinc-300 text-xs">
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
                          <td className="py-4 text-zinc-300 text-xs">
                            {b.delivery_address || "Odbiór własny"}
                          </td>
                          <td className="py-4 text-xs text-zinc-300">
                            {b.protocols.length === 0 ? (
                              <span className="text-zinc-600">Brak</span>
                            ) : (
                              b.protocols.map((p, idx) => (
                                <div key={idx}>
                                  <span className="text-amber-400 font-medium">{p.protocol_type}:</span>{" "}
                                  {p.engine_hours_reading} mth
                                </div>
                              ))
                            )}
                          </td>
                          <td className="py-4 font-semibold text-white">
                            {b.total_price_net} zł
                          </td>
                          <td className="py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${st.cls}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="py-4 text-right space-x-1.5">
                            <a
                              href={`${API_URL}/bookings/${b.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-white/[0.08] text-white hover:bg-white hover:text-black px-3 py-1 rounded-full inline-block transition"
                            >
                              PDF
                            </a>
                            {b.status === "CONFIRMED" && (
                              <button
                                onClick={() => handleStatusChange(b.id, "IN_PROGRESS")}
                                className="text-xs bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 px-3 py-1 rounded-full"
                              >
                                Start
                              </button>
                            )}
                            {(b.status === "CONFIRMED" || b.status === "IN_PROGRESS") && (
                              <>
                                <button
                                  onClick={() => handleStatusChange(b.id, "COMPLETED")}
                                  className="text-xs bg-sky-400/15 text-sky-300 hover:bg-sky-400/25 px-3 py-1 rounded-full"
                                >
                                  Zakończ
                                </button>
                                <button
                                  onClick={() => handleStatusChange(b.id, "CANCELLED")}
                                  className="text-xs bg-rose-400/15 text-rose-300 hover:bg-rose-400/25 px-3 py-1 rounded-full"
                                >
                                  Anuluj
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ZARZĄDZANIE FLOTĄ */}
            <div className="bg-[#121214] border border-white/[0.08] rounded-3xl p-7">
              <h3 className="text-lg font-semibold text-white mb-1">Dodaj nową maszynę do katalogu</h3>
              <p className="text-xs text-zinc-400 mb-5">
                Wprowadź nową jednostkę sprzętową do puli dostępnej na platformie Digvo
              </p>

              <form onSubmit={handleCreateMachine} className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <input
                  type="text"
                  placeholder="Model (np. Minikoparka Bobcat E27)"
                  value={newMachineName}
                  onChange={(e) => setNewMachineName(e.target.value)}
                  className="md:col-span-2 bg-[#09090B] border border-white/[0.1] rounded-2xl px-4 py-2.5 text-sm text-white"
                  required
                />
                <input
                  type="text"
                  placeholder="Kategoria"
                  value={newMachineCategory}
                  onChange={(e) => setNewMachineCategory(e.target.value)}
                  className="bg-[#09090B] border border-white/[0.1] rounded-2xl px-4 py-2.5 text-sm text-white"
                  required
                />
                <input
                  type="number"
                  placeholder="Stawka/doba (zł)"
                  value={newMachineRate}
                  onChange={(e) => setNewMachineRate(e.target.value)}
                  className="bg-[#09090B] border border-white/[0.1] rounded-2xl px-4 py-2.5 text-sm text-white"
                  required
                />
                <input
                  type="number"
                  placeholder="Kaucja (zł)"
                  value={newMachineDeposit}
                  onChange={(e) => setNewMachineDeposit(e.target.value)}
                  className="bg-[#09090B] border border-white/[0.1] rounded-2xl px-4 py-2.5 text-sm text-white"
                  required
                />
                <button
                  type="submit"
                  className="bg-white hover:bg-zinc-200 text-black font-semibold rounded-full px-5 py-2.5 text-sm transition"
                >
                  Dodaj sprzęt
                </button>
              </form>
            </div>

            {/* BLOKADY SERWISOWE UDT */}
            <div className="bg-[#121214] border border-white/[0.08] rounded-3xl p-7">
              <h3 className="text-lg font-semibold text-white mb-1">Blokady serwisowe i przeglądy UDT</h3>
              <p className="text-xs text-zinc-400 mb-5">
                Wyłącz maszynę ze sprzedaży na czas przeglądu technicznego lub konserwacji
              </p>

              <form onSubmit={handleCreateBlock} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                <select
                  value={blockMachineId}
                  onChange={(e) => setBlockMachineId(e.target.value)}
                  className="bg-[#09090B] border border-white/[0.1] rounded-2xl px-4 py-2.5 text-sm text-white"
                >
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  className="bg-[#09090B] border border-white/[0.1] rounded-2xl px-4 py-2.5 text-sm text-white"
                  required
                />
                <select
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="bg-[#09090B] border border-white/[0.1] rounded-2xl px-4 py-2.5 text-sm text-white"
                >
                  <option value="MAINTENANCE">Serwis / Przegląd UDT</option>
                  <option value="VACATION">Postój planowany</option>
                  <option value="SICK_LEAVE">Niedostępność techniczna</option>
                </select>
                <button
                  type="submit"
                  className="bg-rose-500/80 hover:bg-rose-500 text-white font-semibold rounded-full px-5 py-2.5 text-sm transition"
                >
                  Zablokuj maszynę
                </button>
              </form>

              {blocks.length > 0 && (
                <div className="space-y-2">
                  {blocks.map((bl) => (
                    <div
                      key={bl.id}
                      className="flex flex-wrap justify-between items-center gap-3 bg-[#09090B] border border-white/[0.06] px-5 py-3 rounded-2xl text-sm"
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
                          className="text-xs text-zinc-400 hover:text-rose-400 underline"
                        >
                          Usuń
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. PANEL OPERATORA */}
        {activeTab === "operator" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-white tracking-tight">
                Protokoły zdawczo-odbiorcze
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Cyfrowy odczyt licznika motogodzin (mth) przy wydaniu oraz zwrocie sprzętu na budowie
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
                    <div
                      key={b.id}
                      className="bg-[#121214] border border-white/[0.08] rounded-3xl p-6 space-y-5"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-semibold text-lg text-white tracking-tight">
                            {getMachineName(b.machine_id)}
                          </h3>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {b.delivery_address || "Baza Bydgoszcz"} •{" "}
                            {new Date(b.start_time).toLocaleDateString("pl-PL")}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs bg-[#09090B] p-4 rounded-2xl border border-white/[0.06]">
                        <div>
                          <span className="text-zinc-500 block mb-1">Wydanie (PICKUP)</span>
                          <span className="font-semibold text-emerald-400 text-base">
                            {pickup ? `${pickup.engine_hours_reading} mth` : "Oczekuje"}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block mb-1">Zwrot (RETURN)</span>
                          <span className="font-semibold text-sky-400 text-base">
                            {ret ? `${ret.engine_hours_reading} mth` : "Oczekuje"}
                          </span>
                        </div>
                      </div>

                      {(!pickup || !ret) && (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Odczyt licznika (mth)"
                            value={mthInputs[b.id] || ""}
                            onChange={(e) =>
                              setMthInputs((prev) => ({ ...prev, [b.id]: e.target.value }))
                            }
                            className="flex-1 bg-[#09090B] border border-white/[0.1] rounded-full px-4 py-2 text-sm text-white outline-none focus:border-white/[0.3]"
                          />
                          {!pickup ? (
                            <button
                              onClick={() => handleHandover(b.id, "PICKUP")}
                              className="bg-amber-400 hover:bg-amber-300 text-black font-semibold px-5 py-2 rounded-full text-xs transition"
                            >
                              Zapisz PICKUP
                            </button>
                          ) : (
                            <button
                              onClick={() => handleHandover(b.id, "RETURN")}
                              className="bg-white hover:bg-zinc-200 text-black font-semibold px-5 py-2 rounded-full text-xs transition"
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
    </div>
  );
}