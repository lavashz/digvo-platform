"use client";

import { useEffect, useMemo, useState } from "react";

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

const DEMO_ACCOUNTS = [
  { label: "Klient B2B: PW Lech Budownictwo (Bydgoszcz)", email: "zamowienia@pwlech-bydgoszcz.pl", role: "CLIENT" },
  { label: "Klient B2B: Ebud-Przemysłówka S.A. (BPPT)", email: "logistyka@ebud-bydgoszcz.pl", role: "CLIENT" },
  { label: "Klient B2B: KPPRD Inżynieria Drogowa", email: "sprzet@kpprd.pl", role: "CLIENT" },
  { label: "Klient B2B: Aqua-Instal Fordon", email: "biuro@aquainstal-fordon.pl", role: "CLIENT" },
  { label: "Klient: Tomasz Zieliński (Inwestor Fordon)", email: "inwestor@budowa-fordon.pl", role: "CLIENT" },
  { label: "Dyspozytor: Marek Wiśniewski (Graser Centrala)", email: "dyspozytor@graser-bydgoszcz.pl", role: "DISPATCHER" },
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
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

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
        text: "Trwa wybudzanie serwera API lub wystąpił problem z połączeniem. Odśwież stronę za kilka sekund.",
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
      setMessage({ type: "success", text: `Zalogowano pomyślnie jako ${data.full_name}` });
    } catch {
      setMessage({ type: "error", text: "Błąd połączenia z serwerem logowania." });
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
    setMessage({ type: "success", text: "Wylogowano z systemu." });
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
      setMessage({ type: "error", text: "Wybierz konto klienta w pasku u góry ekranu, aby dokonać rezerwacji." });
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
          text: `Zarezerwowano ${selectedMachine.name}! Kwota netto: ${data.total_price_net} PLN (Status: ${data.status})`,
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

  const statusMeta = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return { label: "Potwierdzone", cls: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" };
      case "IN_PROGRESS":
        return { label: "W trakcie pracy", cls: "bg-amber-500/20 text-amber-300 border border-amber-500/30" };
      case "COMPLETED":
        return { label: "Zakończone", cls: "bg-sky-500/20 text-sky-300 border border-sky-500/30" };
      case "CANCELLED":
        return { label: "Anulowane", cls: "bg-rose-500/15 text-rose-400 border border-rose-500/30" };
      default:
        return { label: "Oczekujące", cls: "bg-slate-800 text-slate-300 border border-slate-700" };
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
      return { available: true, label: "Dostępna od ręki", badgeClass: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" };
    }

    const reqStart = new Date(`${date}T${startHour}:00Z`).getTime();
    const reqEnd = new Date(`${date}T${endHour}:00Z`).getTime();
    if (isNaN(reqStart) || isNaN(reqEnd) || reqEnd <= reqStart) {
      return { available: true, label: "Dostępna od ręki", badgeClass: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" };
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
        label: "Przegląd UDT / Serwis",
        badgeClass: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
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
        label: "Zajęta w tym terminie",
        badgeClass: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
      };
    }

    return {
      available: true,
      label: "Dostępna od ręki",
      badgeClass: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    };
  };

  const categories = useMemo(() => {
    const unique = Array.from(new Set(machines.map((m) => m.category)));
    return ["ALL", ...unique];
  }, [machines]);

  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      const matchesCategory = categoryFilter === "ALL" || m.category === categoryFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [machines, categoryFilter, searchQuery]);

  const filteredBookings =
    statusFilter === "ALL"
      ? bookings
      : bookings.filter((b) => b.status === statusFilter);

  const selectedAvailability = selectedMachine ? getMachineAvailability(selectedMachine) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      <header className="border-b border-slate-800/90 bg-slate-900/95 backdrop-blur sticky top-0 z-20 shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black flex items-center justify-center text-xl shadow-md shadow-amber-500/20">
              D
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-white">Digvo</span>
                <span className="text-[11px] bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2.5 py-0.5 rounded-full font-medium">
                  Graser Bydgoszcz • B2B
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                System wynajmu sprzętu budowlanego z obsługą UDT
              </p>
            </div>
          </div>

          <nav className="flex bg-slate-950 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("client")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === "client"
                  ? "bg-amber-500 text-slate-950 font-semibold shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Katalog i Rezerwacje
            </button>
            <button
              onClick={() => setActiveTab("dispatcher")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                activeTab === "dispatcher"
                  ? "bg-amber-500 text-slate-950 font-semibold shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <span>Dyspozytor</span>
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full ${
                  activeTab === "dispatcher" ? "bg-slate-950/20 text-slate-950" : "bg-slate-800 text-slate-300"
                }`}
              >
                {bookings.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("operator")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === "operator"
                  ? "bg-amber-500 text-slate-950 font-semibold shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Panel Operatora
            </button>
          </nav>
        </div>

        {/* PASEK KONTA I SZYBKIEGO PRZEŁĄCZANIA FIRM B2B */}
        <div className="border-t border-slate-800/80 bg-slate-950/90">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            {authUser ? (
              <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-slate-300">
                    Zalogowany jako: <strong className="text-white">{authUser.full_name}</strong>
                  </span>
                  <span className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded font-semibold">
                    {authUser.role}
                  </span>
                </div>

                <div className="flex items-center gap-3 ml-auto">
                  <select
                    aria-label="Przełącz konto demonstracyjne"
                    value=""
                    onChange={(e) => handleQuickAccountSelect(e.target.value)}
                    className="bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg px-2.5 py-1 text-slate-200 text-xs cursor-pointer"
                  >
                    <option value="" disabled>
                      Przełącz firmę / rolę demo...
                    </option>
                    {DEMO_ACCOUNTS.map((acc) => (
                      <option key={acc.email} value={acc.email}>
                        {acc.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleLogout}
                    className="bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 px-3 py-1 rounded-lg font-medium transition"
                  >
                    Wyloguj
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                <form onSubmit={handleLogin} className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400 font-medium">Logowanie:</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E-mail firmowy"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 w-52"
                    required
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Hasło"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 w-24"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-3.5 py-1 rounded-lg transition"
                  >
                    Zaloguj
                  </button>
                </form>

                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-slate-400 hidden sm:inline">Szybkie logowanie B2B:</span>
                  <select
                    aria-label="Wybierz firmę demo"
                    defaultValue=""
                    onChange={(e) => handleQuickAccountSelect(e.target.value)}
                    className="bg-slate-900 border border-amber-500/40 hover:border-amber-400 rounded-lg px-3 py-1 text-amber-200 text-xs font-medium cursor-pointer"
                  >
                    <option value="" disabled>
                      Wybierz firmę lub rolę (1 kliknięcie)...
                    </option>
                    {DEMO_ACCOUNTS.map((acc) => (
                      <option key={acc.email} value={acc.email} className="bg-slate-900 text-slate-100">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-center justify-between gap-4 ${
              message.type === "success"
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950/60 border-rose-500/40 text-rose-200"
            }`}
          >
            <span className="text-sm">{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="text-xs opacity-70 hover:opacity-100 px-2 py-1"
            >
              Zamknij
            </button>
          </div>
        )}

        {/* 1. WIDOK KLIENTA */}
        {activeTab === "client" && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-2 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      1. Katalog sprzętu budowlanego
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Baza sprzętu Graser Bydgoszcz • Aktualna dostępność dla daty{" "}
                      <span className="text-slate-200 font-medium">{date}</span>
                    </p>
                  </div>

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Szukaj maszyny (np. CAT, JCB, Bobcat)..."
                    className="bg-slate-900 border border-slate-700 focus:border-amber-500 outline-none rounded-xl px-3.5 py-2 text-sm text-slate-100 w-full sm:w-64"
                  />
                </div>

                {/* Pasek filtrów kategorii */}
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        categoryFilter === cat
                          ? "bg-amber-500 text-slate-950 font-semibold"
                          : "bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      {cat === "ALL" ? `Wszystkie (${machines.length})` : cat}
                    </button>
                  ))}
                </div>

                {initialLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        className="h-44 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse p-5"
                      />
                    ))}
                  </div>
                ) : filteredMachines.length === 0 ? (
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center text-sm text-slate-400">
                    Brak maszyn spełniających kryteria wyszukiwania.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredMachines.map((m) => {
                      const isSelected = selectedMachine?.id === m.id;
                      const availability = getMachineAvailability(m);
                      return (
                        <div
                          key={m.id}
                          onClick={() => setSelectedMachine(m)}
                          className={`cursor-pointer rounded-xl p-5 border transition flex flex-col justify-between ${
                            isSelected
                              ? "bg-slate-900 border-amber-500 ring-2 ring-amber-500/40 shadow-lg shadow-amber-500/5"
                              : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80"
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold">
                                {m.category}
                              </span>
                              <span
                                className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${availability.badgeClass}`}
                              >
                                {availability.label}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-white mt-1.5 leading-snug">
                              {m.name}
                            </h3>
                          </div>

                          <div className="mt-5 pt-3.5 border-t border-slate-800/80">
                            <div className="flex items-baseline justify-between">
                              <span className="text-xs text-slate-400">Stawka dobowa:</span>
                              <div className="text-right">
                                <span className="text-base font-bold text-white">
                                  {m.daily_rate_net} PLN
                                </span>
                                <span className="text-xs text-slate-400 ml-1">netto</span>
                              </div>
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 mt-1.5">
                              <span>Kaucja: {m.deposit_amount} PLN</span>
                              <span>Transport: {m.transport_rate_per_km} PLN/km</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Prawa kolumna: Przyklejony kalkulator */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:sticky lg:top-28 shadow-xl shadow-black/20">
                <h2 className="text-lg font-bold text-white mb-1">2. Konfiguracja i wycena</h2>
                {selectedMachine ? (
                  <>
                    <div className="mb-4 pb-3 border-b border-slate-800 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Wybrana maszyna:</span>
                        <span className="text-sm font-semibold text-amber-400">
                          {selectedMachine.name}
                        </span>
                      </div>
                      {selectedAvailability && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${selectedAvailability.badgeClass}`}
                        >
                          {selectedAvailability.label}
                        </span>
                      )}
                    </div>

                    <form onSubmit={handleBooking} className="space-y-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Data realizacji</label>
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 outline-none rounded-lg px-3 py-2 text-sm"
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
                            className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 outline-none rounded-lg px-3 py-2 text-sm"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Do godziny</label>
                          <input
                            type="time"
                            value={endHour}
                            onChange={(e) => setEndHour(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 outline-none rounded-lg px-3 py-2 text-sm"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 cursor-pointer transition">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={withOperator}
                              onChange={(e) => setWithOperator(e.target.checked)}
                              className="accent-amber-500 w-4 h-4"
                            />
                            <span className="text-sm text-slate-200">Z operatorem UDT</span>
                          </div>
                          <span className="text-xs text-slate-400">65 PLN/h</span>
                        </label>

                        <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 cursor-pointer transition">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={withTransport}
                              onChange={(e) => setWithTransport(e.target.checked)}
                              className="accent-amber-500 w-4 h-4"
                            />
                            <span className="text-sm text-slate-200">Transport lawetą</span>
                          </div>
                          <span className="text-xs text-slate-400">
                            {selectedMachine.transport_rate_per_km} PLN/km
                          </span>
                        </label>
                      </div>

                      {withTransport && (
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            Adres placu budowy (Bydgoszcz i okolice)
                          </label>
                          <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 outline-none rounded-lg px-3 py-2 text-sm"
                            required
                          />
                        </div>
                      )}

                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Wynajem maszyny ({estimate.days} doba):</span>
                          <span className="text-slate-200">{estimate.machineCost.toFixed(2)} PLN</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Operator UDT ({estimate.hours}h):</span>
                          <span className="text-slate-200">{estimate.operatorCost.toFixed(2)} PLN</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Transport (dostawa + odbiór):</span>
                          <span className="text-slate-200">{estimate.transportCost.toFixed(2)} PLN</span>
                        </div>
                        <div className="pt-2.5 border-t border-slate-800 flex justify-between text-sm font-bold">
                          <span>Razem netto:</span>
                          <span className="text-amber-400">{estimate.totalNet.toFixed(2)} PLN</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-300">
                          <span>Razem brutto (23% VAT):</span>
                          <span className="font-semibold">{estimate.totalGross.toFixed(2)} PLN</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                          <span>Kaucja zwrotna (blokada):</span>
                          <span>{selectedMachine.deposit_amount} PLN</span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className={`w-full font-bold py-3 rounded-xl transition disabled:opacity-50 ${
                          selectedAvailability && !selectedAvailability.available
                            ? "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40"
                            : "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/15"
                        }`}
                      >
                        {loading
                          ? "Sprawdzanie zasobów..."
                          : selectedAvailability && !selectedAvailability.available
                          ? "Termin zajęty (sprawdź konflikt)"
                          : "Zarezerwuj sprzęt"}
                      </button>
                    </form>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Ładowanie katalogu floty...</p>
                )}
              </div>
            </div>

            {/* MOJE REZERWACJE KLIENTA */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-white">Moje rezerwacje i dokumenty</h3>
                  <p className="text-sm text-slate-400">
                    Historia zamówień Twojej firmy w systemie Digvo wraz z umowami PDF
                  </p>
                </div>
                {authUser && (
                  <span className="text-xs bg-slate-800 text-slate-200 px-3 py-1.5 rounded-full font-medium">
                    Liczba zleceń: {myBookings.length}
                  </span>
                )}
              </div>

              {!authUser ? (
                <div className="text-sm text-slate-300 bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
                  <span>
                    Wybierz firmę z listy <strong>Szybkie logowanie B2B</strong> u góry ekranu, aby zobaczyć swoje zamówienia i pobrać wygenerowane umowy PDF.
                  </span>
                </div>
              ) : myBookings.length === 0 ? (
                <div className="text-sm text-slate-400 bg-slate-950 border border-slate-800 rounded-xl p-5">
                  Brak rezerwacji przypisanych do konta <strong>{authUser.full_name}</strong>. Wybierz maszynę powyżej i złóż pierwsze zamówienie!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-800 text-slate-400 text-xs uppercase">
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
                      {myBookings.map((b) => {
                        const st = statusMeta(b.status);
                        return (
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
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                                {st.label}
                              </span>
                            </td>
                            <td className="py-3.5 text-right">
                              <a
                                href={`${API_URL}/bookings/${b.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 px-3 py-1.5 rounded-lg font-medium inline-block transition"
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
            </div>
          </div>
        )}

        {/* 2. PANEL DYSPOZYTORA */}
        {activeTab === "dispatcher" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <span className="text-xs text-slate-400 uppercase tracking-wider">
                  Przychód netto (aktywny)
                </span>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  {totalRevenueNet.toFixed(2)} PLN
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <span className="text-xs text-slate-400 uppercase tracking-wider">Aktywne zlecenia</span>
                <div className="text-2xl font-bold text-white mt-1">
                  {activeBookingsCount}{" "}
                  <span className="text-xs font-normal text-slate-400">/ {bookings.length}</span>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <span className="text-xs text-slate-400 uppercase tracking-wider">Przepracowane mth</span>
                <div className="text-2xl font-bold text-amber-400 mt-1">
                  {totalWorkedMth.toFixed(1)} mth
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <span className="text-xs text-slate-400 uppercase tracking-wider">
                  Blokady serwisowe UDT
                </span>
                <div className="text-2xl font-bold text-rose-400 mt-1">{blocks.length}</div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Harmonogram zleceń (Dyspozytor)</h2>
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
                      className={`text-xs px-3 py-1.5 rounded-lg transition ${
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
                  <thead className="border-b border-slate-800 text-slate-400 text-xs uppercase">
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
                    {filteredBookings.map((b) => {
                      const st = statusMeta(b.status);
                      return (
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
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="py-3.5 text-right space-x-1.5">
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ZARZĄDZANIE FLOTĄ - DODAWANIE MASZYNY (Tylko w panelu Dyspozytora) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-1">Zarządzanie flotą (Dodaj maszynę)</h3>
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

            {/* BLOKADY SERWISOWE UDT */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-1">Blokady serwisowe i przeglądy UDT</h3>
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

        {/* 3. PANEL OPERATORA */}
        {activeTab === "operator" && (
          <div className="space-y-4">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-white">Panel Operatora (Protokoły zdawczo-odbiorcze)</h2>
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
                  const st = statusMeta(b.status);

                  return (
                    <div
                      key={b.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-bold text-lg text-white">
                            {getMachineName(b.machine_id)}
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {b.delivery_address || "Baza Graser Bydgoszcz"} •{" "}
                            {new Date(b.start_time).toLocaleDateString("pl-PL")}
                          </p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                        <div>
                          <span className="text-slate-400 block mb-0.5">Wydanie (PICKUP):</span>
                          <span className="font-semibold text-emerald-400 text-sm">
                            {pickup ? `${pickup.engine_hours_reading} mth` : "Oczekuje"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Zwrot (RETURN):</span>
                          <span className="font-semibold text-sky-400 text-sm">
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
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm transition"
                            >
                              Zapisz PICKUP
                            </button>
                          ) : (
                            <button
                              onClick={() => handleHandover(b.id, "RETURN")}
                              className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm transition"
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