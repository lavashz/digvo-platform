"use client";

import { useEffect, useState } from "react";

interface Machine {
  id: string;
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const AUTH_STORAGE_KEY = "digvo_auth_user";

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
  const [email, setEmail] = useState("inwestor@budowa-fordon.pl");
  const [password, setPassword] = useState("haslo123");

  const [activeTab, setActiveTab] = useState<"client" | "dispatcher" | "operator">("client");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<UnavailabilityBlock[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

  // Formularz rezerwacji klienta
  const [date, setDate] = useState("2026-11-26");
  const [startHour, setStartHour] = useState("08:00");
  const [endHour, setEndHour] = useState("16:00");
  const [withOperator, setWithOperator] = useState(true);
  const [withTransport, setWithTransport] = useState(true);
  const [address, setAddress] = useState("ul. Fordońska 40, Bydgoszcz");

  // Formularz blokady serwisowej (Dyspozytor)
  const [blockMachineId, setBlockMachineId] = useState("");
  const [blockDate, setBlockDate] = useState("2026-11-27");
  const [blockReason, setBlockReason] = useState("MAINTENANCE");

  // Formularz dodawania nowej maszyny (Dyspozytor)
  const [newMachineName, setNewMachineName] = useState("");
  const [newMachineCategory, setNewMachineCategory] = useState("Minikoparki");
  const [newMachineRate, setNewMachineRate] = useState("450");
  const [newMachineDeposit, setNewMachineDeposit] = useState("1000");
  const [newMachineBuffer, setNewMachineBuffer] = useState("2");

  // Formularz operatora (motogodziny)
  const [mthInputs, setMthInputs] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
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
      // Ciche pominięcie błędu sieci w tle
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
        if (!selectedMachine) setSelectedMachine(mData[0]);
        if (!blockMachineId) setBlockMachineId(mData[0].id);
      }
      const tokenToUse = currentToken || authUser?.token;
      if (tokenToUse) {
        await fetchMyBookings(tokenToUse);
      }
    } catch {
      setMessage({
        type: "error",
        text: "Nie można połączyć z backendem (upewnij się, że uvicorn działa na porcie 8000).",
      });
    }
  };

  // Odczyt zapisanej sesji JWT przy pierwszym uruchomieniu / po F5
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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
      setMessage({ type: "success", text: `Zalogowano jako ${data.full_name} (Rola: ${data.role})` });
    } catch {
      setMessage({ type: "error", text: "Błąd połączenia z serwerem logowania." });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthUser(null);
    setMyBookings([]);
    setActiveTab("client");
    setMessage({ type: "success", text: "Wylogowano z systemu." });
  };

  const quickFillAccount = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword("haslo123");
  };

  const authHeaders = () => ({
    "Content-Type": "application/json",
    ...(authUser ? { Authorization: `Bearer ${authUser.token}` } : {}),
  });

  const calculateEstimate = () => {
    if (!selectedMachine) {
      return { hours: 0, machineCost: 0, operatorCost: 0, transportCost: 0, total: 0 };
    }
    const [sh, sm] = startHour.split(":").map(Number);
    const [eh, em] = endHour.split(":").map(Number);
    const hours = Math.max(0, eh + em / 60 - (sh + sm / 60));
    const days = Math.max(1, Math.ceil(hours / 24));

    const machineCost = days * selectedMachine.daily_rate_net;
    const operatorCost = withOperator ? hours * 65 : 0;
    const transportCost = withTransport ? 3.1 * 2 * selectedMachine.transport_rate_per_km : 0;
    const total = machineCost + operatorCost + transportCost;

    return {
      hours: Number(hours.toFixed(1)),
      machineCost: Number(machineCost.toFixed(2)),
      operatorCost: Number(operatorCost.toFixed(2)),
      transportCost: Number(transportCost.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  };

  const estimate = calculateEstimate();

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachine) return;
    if (!authUser) {
      setMessage({ type: "error", text: "Zaloguj się u góry ekranu, aby dokonać rezerwacji." });
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
        setMessage({
          type: "success",
          text: `Zarezerwowano! Kwota netto: ${data.total_price_net} PLN (Status: ${data.status})`,
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
    if (!blockMachineId) return;
    if (!authUser) {
      setMessage({ type: "error", text: "Zaloguj się jako Dyspozytor, aby zarządzać blokadami." });
      return;
    }
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
    if (!authUser) {
      setMessage({ type: "error", text: "Zaloguj się jako Dyspozytor, aby usunąć blokadę." });
      return;
    }
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
    if (!authUser) {
      setMessage({ type: "error", text: "Zaloguj się jako Dyspozytor, aby dodać maszynę." });
      return;
    }
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
    if (!authUser) {
      setMessage({ type: "error", text: "Zaloguj się jako Dyspozytor." });
      return;
    }
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
    if (!authUser) {
      setMessage({ type: "error", text: "Zaloguj się jako Operator." });
      return;
    }
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

  const statusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-emerald-500/15 text-emerald-300";
      case "IN_PROGRESS":
        return "bg-amber-500/20 text-amber-300";
      case "COMPLETED":
        return "bg-sky-500/20 text-sky-300";
      case "CANCELLED":
        return "bg-rose-500/15 text-rose-400";
      default:
        return "bg-slate-700 text-slate-300";
    }
  };

  // Statystyki KPI dla Dyspozytora
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
      return { available: true, label: "Dostępna", badgeClass: "bg-emerald-500/15 text-emerald-300" };
    }

    const reqStart = new Date(`${date}T${startHour}:00Z`).getTime();
    const reqEnd = new Date(`${date}T${endHour}:00Z`).getTime();
    if (isNaN(reqStart) || isNaN(reqEnd) || reqEnd <= reqStart) {
      return { available: true, label: "Dostępna", badgeClass: "bg-emerald-500/15 text-emerald-300" };
    }

    const bufferMs = machine.service_buffer_hours * 60 * 60 * 1000;

    // 1. Sprawdzenie blokad serwisowych UDT
    const hasBlock = blocks.some((bl) => {
      if (bl.machine_id !== machine.id) return false;
      const blStart = new Date(bl.start_time).getTime();
      const blEnd = new Date(bl.end_time).getTime();
      return reqStart < blEnd && reqEnd > blStart;
    });

    if (hasBlock) {
      return {
        available: false,
        label: "Serwis / Przegląd UDT",
        badgeClass: "bg-rose-500/20 text-rose-300",
      };
    }

    // 2. Sprawdzenie istniejących rezerwacji + bufora serwisowego
    const hasBookingConflict = bookings.some((b) => {
      if (b.machine_id !== machine.id || b.status === "CANCELLED") return false;
      const bStart = new Date(b.start_time).getTime() - bufferMs;
      const bEnd = new Date(b.end_time).getTime() + bufferMs;
      return reqStart < bEnd && reqEnd > bStart;
    });

    if (hasBookingConflict) {
      return {
        available: false,
        label: "Zajęta / Bufor serwisowy",
        badgeClass: "bg-amber-500/20 text-amber-300",
      };
    }

    return {
      available: true,
      label: "Dostępna",
      badgeClass: "bg-emerald-500/15 text-emerald-300",
    };
  };
  const filteredBookings =
    statusFilter === "ALL"
      ? bookings
      : bookings.filter((b) => b.status === statusFilter);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xl">
              D
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight">Digvo</span>
              <span className="ml-2 text-xs bg-slate-800 text-amber-400 px-2 py-0.5 rounded-full">
                Bydgoszcz Pilot
              </span>
            </div>
          </div>

          <div className="flex bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("client")}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition ${
                activeTab === "client"
                  ? "bg-amber-500 text-slate-950 font-semibold"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Widok Klienta
            </button>
            <button
              onClick={() => setActiveTab("dispatcher")}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition ${
                activeTab === "dispatcher"
                  ? "bg-amber-500 text-slate-950 font-semibold"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Dyspozytor ({bookings.length})
            </button>
            <button
              onClick={() => setActiveTab("operator")}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition ${
                activeTab === "operator"
                  ? "bg-amber-500 text-slate-950 font-semibold"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Panel Operatora
            </button>
          </div>
        </div>

        {/* PASEK AUTORYZACJI JWT */}
        <div className="border-t border-slate-800/80 bg-slate-950/80">
          <div className="max-w-6xl mx-auto px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            {authUser ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="text-slate-300">
                    Zalogowany: <strong className="text-white">{authUser.full_name}</strong>
                  </span>
                  <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-semibold">
                    {authUser.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-rose-400 hover:text-rose-300 underline"
                >
                  Wyloguj (JWT)
                </button>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="flex flex-wrap items-center gap-2 w-full">
                <span className="text-slate-400 font-medium">Logowanie JWT:</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-mail"
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200"
                  required
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Hasło"
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 w-28"
                  required
                />
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-3 py-1 rounded"
                >
                  Zaloguj
                </button>
                <div className="flex items-center gap-1.5 ml-auto text-[11px] text-slate-400">
                  <span>Szybki wybór:</span>
                  <button
                    type="button"
                    onClick={() => quickFillAccount("inwestor@budowa-fordon.pl")}
                    className="bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-slate-200"
                  >
                    Klient
                  </button>
                  <button
                    type="button"
                    onClick={() => quickFillAccount("dyspozytor@graser-bydgoszcz.pl")}
                    className="bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-slate-200"
                  >
                    Dyspozytor
                  </button>
                  <button
                    type="button"
                    onClick={() => quickFillAccount("j.kowalski@graser-bydgoszcz.pl")}
                    className="bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-slate-200"
                  >
                    Operator
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border ${
              message.type === "success"
                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-200"
                : "bg-rose-950/60 border-rose-500/50 text-rose-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 1. WIDOK KLIENTA */}
        {activeTab === "client" && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-lg font-semibold text-slate-200">
                  1. Wybierz sprzęt budowlany (Graser Bydgoszcz)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {machines.map((m) => {
                    const isSelected = selectedMachine?.id === m.id;
                    const availability = getMachineAvailability(m);
                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMachine(m)}
                        className={`cursor-pointer rounded-xl p-5 border transition ${
                          isSelected
                            ? "bg-slate-900 border-amber-500 ring-1 ring-amber-500"
                            : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
                            {m.category}
                          </span>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${availability.badgeClass}`}
                          >
                            {availability.label}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold mt-1">{m.name}</h3>
                        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between text-sm">
                          <span className="text-slate-400">Stawka dobowa:</span>
                          <span className="font-bold text-white">{m.daily_rate_net} PLN netto</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 mt-1">
                          <span>Kaucja: {m.deposit_amount} PLN</span>
                          <span>Bufor: {m.service_buffer_hours}h</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-fit">
                <h2 className="text-lg font-semibold mb-4">2. Konfiguracja i wycena</h2>
                {selectedMachine ? (
                  <form onSubmit={handleBooking} className="space-y-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Data realizacji</label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Od godziny</label>
                        <input
                          type="time"
                          value={startHour}
                          onChange={(e) => setStartHour(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Do godziny</label>
                        <input
                          type="time"
                          value={endHour}
                          onChange={(e) => setEndHour(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                          required
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={withOperator}
                        onChange={(e) => setWithOperator(e.target.checked)}
                        className="accent-amber-500 w-4 h-4"
                      />
                      <span className="text-sm">Z operatorem (uprawnienia UDT)</span>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={withTransport}
                        onChange={(e) => setWithTransport(e.target.checked)}
                        className="accent-amber-500 w-4 h-4"
                      />
                      <span className="text-sm">Z transportem na budowę</span>
                    </label>

                    {withTransport && (
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Adres budowy</label>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                          required
                        />
                      </div>
                    )}

                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Wynajem maszyny (1 doba):</span>
                        <span className="text-slate-200">{estimate.machineCost} PLN</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Operator UDT ({estimate.hours}h):</span>
                        <span className="text-slate-200">{estimate.operatorCost} PLN</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Transport (dostawa + odbiór):</span>
                        <span className="text-slate-200">{estimate.transportCost} PLN</span>
                      </div>
                      <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-bold">
                        <span>Razem netto:</span>
                        <span className="text-amber-400">{estimate.total} PLN</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Kaucja zwrotna (blokada):</span>
                        <span>{selectedMachine.deposit_amount} PLN</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-lg transition disabled:opacity-50"
                    >
                      {loading ? "Sprawdzanie zasobów..." : "Rezerwuj termin"}
                    </button>
                  </form>
                ) : (
                  <p className="text-sm text-slate-400">Ładowanie floty...</p>
                )}
              </div>
            </div>

            {/* MOJE REZERWACJE KLIENTA */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold">Moje rezerwacje i dokumenty</h3>
                  <p className="text-sm text-slate-400">
                    Historia Twoich zamówień w systemie Digvo wraz z umowami PDF
                  </p>
                </div>
                {authUser && (
                  <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full">
                    Liczba zleceń: {myBookings.length}
                  </span>
                )}
              </div>

              {!authUser ? (
                <div className="text-sm text-slate-400 bg-slate-950 border border-slate-800 rounded-lg p-4">
                  Zaloguj się na swoje konto (np. klikając <strong>Klient</strong> u góry ekranu i{" "}
                  <strong>Zaloguj</strong>), aby zobaczyć swoje rezerwacje i pobrać umowy PDF.
                </div>
              ) : myBookings.length === 0 ? (
                <div className="text-sm text-slate-400 bg-slate-950 border border-slate-800 rounded-lg p-4">
                  Nie masz jeszcze żadnych rezerwacji na tym koncie. Skorzystaj z konfiguratora powyżej!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-800 text-slate-400">
                      <tr>
                        <th className="pb-3">Maszyna</th>
                        <th className="pb-3">Termin realizacji</th>
                        <th className="pb-3">Operator UDT</th>
                        <th className="pb-3">Adres dostawy</th>
                        <th className="pb-3">Kwota netto</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Dokument</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {myBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-800/30">
                          <td className="py-3.5 font-medium text-white">
                            {getMachineName(b.machine_id)}
                          </td>
                          <td className="py-3.5 text-slate-300">
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
                          <td className="py-3.5 text-slate-300">
                            {b.operator_name || <span className="text-slate-500">Bez operatora</span>}
                          </td>
                          <td className="py-3.5 text-slate-300">
                            {b.delivery_address || "Odbiór własny"}
                          </td>
                          <td className="py-3.5 font-semibold text-emerald-400">
                            {b.total_price_net} PLN
                          </td>
                          <td className="py-3.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(
                                b.status
                              )}`}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td className="py-3.5 text-right">
                            <a
                              href={`${API_URL}/bookings/${b.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-3 py-1.5 rounded font-medium inline-block"
                            >
                              Umowa PDF
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. PANEL DYSPOZYTORA */}
        {activeTab === "dispatcher" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <span className="text-xs text-slate-400 uppercase tracking-wider">
                  Przychód netto (aktywny)
                </span>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  {totalRevenueNet.toFixed(2)} PLN
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <span className="text-xs text-slate-400 uppercase tracking-wider">Aktywne zlecenia</span>
                <div className="text-2xl font-bold text-white mt-1">
                  {activeBookingsCount}{" "}
                  <span className="text-xs font-normal text-slate-400">/ {bookings.length}</span>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <span className="text-xs text-slate-400 uppercase tracking-wider">Przepracowane mth</span>
                <div className="text-2xl font-bold text-amber-400 mt-1">
                  {totalWorkedMth.toFixed(1)} mth
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <span className="text-xs text-slate-400 uppercase tracking-wider">
                  Blokady serwisowe UDT
                </span>
                <div className="text-2xl font-bold text-rose-400 mt-1">{blocks.length}</div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold">Harmonogram zleceń (Dyspozytor)</h2>
                  <p className="text-sm text-slate-400">
                    Zarządzanie statusami, protokołami mth i dokumentacją PDF
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
                      className={`text-xs px-2.5 py-1.5 rounded-lg transition ${
                        statusFilter === f.key
                          ? "bg-amber-500 text-slate-950 font-semibold"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="pb-3">Maszyna</th>
                      <th className="pb-3">Termin</th>
                      <th className="pb-3">Lokalizacja</th>
                      <th className="pb-3">Protokoły mth</th>
                      <th className="pb-3">Kwota netto</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-800/30">
                        <td className="py-3.5 font-medium text-white">
                          {getMachineName(b.machine_id)}
                        </td>
                        <td className="py-3.5 text-slate-300">
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
                        <td className="py-3.5 text-slate-300">
                          {b.delivery_address || "Odbiór własny"}
                        </td>
                        <td className="py-3.5 text-xs text-slate-300">
                          {b.protocols.length === 0 ? (
                            <span className="text-slate-500">Brak</span>
                          ) : (
                            b.protocols.map((p, idx) => (
                              <div key={idx}>
                                <span className="text-amber-400 font-semibold">{p.protocol_type}:</span>{" "}
                                {p.engine_hours_reading} mth
                              </div>
                            ))
                          )}
                        </td>
                        <td className="py-3.5 font-semibold text-emerald-400">
                          {b.total_price_net} PLN
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(
                              b.status
                            )}`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right space-x-2">
                          <a
                            href={`${API_URL}/bookings/${b.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs bg-slate-800 text-slate-200 hover:bg-slate-700 px-2.5 py-1 rounded inline-block"
                          >
                            PDF
                          </a>
                          {b.status === "CONFIRMED" && (
                            <button
                              onClick={() => handleStatusChange(b.id, "IN_PROGRESS")}
                              className="text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-2.5 py-1 rounded"
                            >
                              Start
                            </button>
                          )}
                          {(b.status === "CONFIRMED" || b.status === "IN_PROGRESS") && (
                            <>
                              <button
                                onClick={() => handleStatusChange(b.id, "COMPLETED")}
                                className="text-xs bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 px-2.5 py-1 rounded"
                              >
                                Zakończ
                              </button>
                              <button
                                onClick={() => handleStatusChange(b.id, "CANCELLED")}
                                className="text-xs bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 px-2.5 py-1 rounded"
                              >
                                Anuluj
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-bold mb-1">Blokady serwisowe i przeglądy UDT</h3>
              <p className="text-sm text-slate-400 mb-4">
                Wyłącz maszynę ze sprzedaży na czas przeglądu okresowego lub naprawy
              </p>

              <form onSubmit={handleCreateBlock} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                <select
                  value={blockMachineId}
                  onChange={(e) => setBlockMachineId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
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
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                  required
                />
                <select
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="MAINTENANCE">Serwis / Przegląd UDT</option>
                  <option value="VACATION">Urlop / Postój planowany</option>
                  <option value="SICK_LEAVE">Niedostępność / Chorobowe</option>
                </select>
                <button
                  type="submit"
                  className="bg-rose-500/80 hover:bg-rose-500 text-white font-semibold rounded-lg px-4 py-2 text-sm transition"
                >
                  Zablokuj maszynę
                </button>
              </form>

              {blocks.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-400 uppercase">Aktywne blokady:</div>
                  {blocks.map((bl) => (
                    <div
                      key={bl.id}
                      className="flex flex-wrap justify-between items-center gap-3 bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-lg text-sm"
                    >
                      <span className="font-medium text-slate-200">{getMachineName(bl.machine_id)}</span>
                      <span className="text-slate-400">
                        {new Date(bl.start_time).toLocaleDateString("pl-PL")}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="bg-rose-500/15 text-rose-300 px-2.5 py-0.5 rounded-full text-xs">
                          {bl.reason}
                        </span>
                        <button
                          onClick={() => handleDeleteBlock(bl.id)}
                          className="text-xs text-slate-400 hover:text-rose-400 underline"
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

        {/* ZARZĄDZANIE FLOTĄ - DODAWANIE MASZYNY */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-bold mb-1">Zarządzanie flotą (Dodaj maszynę)</h3>
              <p className="text-sm text-slate-400 mb-4">
                Rozszerz katalog sprzętu dostępnego do rezerwacji w oddziale Bydgoszcz
              </p>

              <form onSubmit={handleCreateMachine} className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <input
                  type="text"
                  placeholder="Nazwa (np. Minikoparka Bobcat E27)"
                  value={newMachineName}
                  onChange={(e) => setNewMachineName(e.target.value)}
                  className="md:col-span-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="Kategoria (np. Minikoparki)"
                  value={newMachineCategory}
                  onChange={(e) => setNewMachineCategory(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                  required
                />
                <input
                  type="number"
                  placeholder="Stawka/doba (PLN)"
                  value={newMachineRate}
                  onChange={(e) => setNewMachineRate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                  required
                />
                <input
                  type="number"
                  placeholder="Kaucja (PLN)"
                  value={newMachineDeposit}
                  onChange={(e) => setNewMachineDeposit(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                  required
                />
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg px-4 py-2 text-sm transition"
                >
                  Dodaj sprzęt
                </button>
              </form>
            </div>

        {/* 3. PANEL OPERATORA */}
        {activeTab === "operator" && (
          <div className="space-y-4">
            <div className="mb-4">
              <h2 className="text-xl font-bold">Panel Operatora (Protokoły zdawczo-odbiorcze)</h2>
              <p className="text-sm text-slate-400">
                Rejestracja stanu motogodzin przy wydaniu (PICKUP) oraz zwrocie (RETURN) sprzętu
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bookings
                .filter((b) => b.status !== "CANCELLED")
                .map((b) => {
                  const pickup = b.protocols.find((p) => p.protocol_type === "PICKUP");
                  const ret = b.protocols.find((p) => p.protocol_type === "RETURN");

                  return (
                    <div
                      key={b.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-lg text-white">
                            {getMachineName(b.machine_id)}
                          </h3>
                          <p className="text-xs text-slate-400">
                            {b.delivery_address || "Baza Graser Bydgoszcz"} •{" "}
                            {new Date(b.start_time).toLocaleDateString("pl-PL")}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(
                            b.status
                          )}`}
                        >
                          {b.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <div>
                          <span className="text-slate-400 block">Wydanie (PICKUP):</span>
                          <span className="font-semibold text-emerald-400">
                            {pickup ? `${pickup.engine_hours_reading} mth` : "Oczekuje"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Zwrot (RETURN):</span>
                          <span className="font-semibold text-sky-400">
                            {ret ? `${ret.engine_hours_reading} mth` : "Oczekuje"}
                          </span>
                        </div>
                      </div>

                      {(!pickup || !ret) && (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Stan licznika (mth)"
                            value={mthInputs[b.id] || ""}
                            onChange={(e) =>
                              setMthInputs((prev) => ({ ...prev, [b.id]: e.target.value }))
                            }
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                          />
                          {!pickup ? (
                            <button
                              onClick={() => handleHandover(b.id, "PICKUP")}
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm"
                            >
                              Zapisz PICKUP
                            </button>
                          ) : (
                            <button
                              onClick={() => handleHandover(b.id, "RETURN")}
                              className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm"
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