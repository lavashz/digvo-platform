"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LoginModal from "../components/LoginModal";
import SiteHeader from "../components/SiteHeader";
import { PinIcon } from "../components/Icons";
import { useAuth } from "../lib/auth";
import { API_URL, authHeaders, formatApiError } from "../lib/api";
import { DEMO_ACCOUNTS, INPUT_CLS, statusMeta } from "../lib/vendors";
import type { Booking, Machine, UnavailabilityBlock } from "../lib/types";
import { t, type Locale, type Currency } from "../lib/i18n";
import Toast from "../components/Toast";
import { useFlash } from "../lib/flash";
import FleetGantt from "../components/FleetGantt";

export default function PanelPage() {
  const {
    authUser,
    ready,
    showLogin,
    setShowLogin,
    loginError,
    closeLogin,
    clearLoginError,
    logout,
    performLogin,
    performRegister,
    quickLogin,
  } = useAuth();

  const [locale, setLocale] = useState<Locale>("pl");
  const [currency, setCurrency] = useState<Currency>("PLN");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<UnavailabilityBlock[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [timeFilter, setTimeFilter] = useState<"ALL" | "TODAY" | "WEEK" | "DAY">("WEEK");
  const [dayFilterIso, setDayFilterIso] = useState<string | null>(null);
  const [ganttMode, setGanttMode] = useState<"week" | "day">("week");
  const [ganttAnchor, setGanttAnchor] = useState(() => new Date());
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [mthInputs, setMthInputs] = useState<Record<string, string>>({});

  const [blockMachineId, setBlockMachineId] = useState("");
  const [blockDate, setBlockDate] = useState("2027-01-15");
  const [blockReason, setBlockReason] = useState("MAINTENANCE");
  const [newMachineName, setNewMachineName] = useState("");
  const [newMachineCategory, setNewMachineCategory] = useState("Minikoparki");
  const [newMachineRate, setNewMachineRate] = useState("450");
  const [newMachineDeposit, setNewMachineDeposit] = useState("1000");
  const [newMachineBuffer, setNewMachineBuffer] = useState("2");

  const [loading, setLoading] = useState(false);
  const { flash, show, clear } = useFlash();

  useEffect(() => {
    const savedLocale = localStorage.getItem("digvo_locale");
    const savedCurrency = localStorage.getItem("digvo_currency");
    if (savedLocale === "pl" || savedLocale === "en") setLocale(savedLocale);
    if (savedCurrency === "PLN" || savedCurrency === "EUR") setCurrency(savedCurrency);
  }, []);

  useEffect(() => {
    localStorage.setItem("digvo_locale", locale);
    localStorage.setItem("digvo_currency", currency);
  }, [locale, currency]);

  const reload = async () => {
    setLoading(true);
    try {
        const [mRes, bRes, blRes] = await Promise.all([
        fetch(`${API_URL}/machines`),
        fetch(`${API_URL}/bookings`),
        fetch(`${API_URL}/blocks`),
        ]);
        const mData = await mRes.json();
        const bData = await bRes.json();
        const blData = await blRes.json();
        setMachines(Array.isArray(mData) ? mData : []);
        setBookings(Array.isArray(bData) ? bData : []);
        setBlocks(Array.isArray(blData) ? blData : []);
        if (Array.isArray(mData) && mData[0] && !blockMachineId) {
        setBlockMachineId(mData[0].id);
        }
    } catch {
        show("Nie udało się pobrać danych panelu.", "error");
    } finally {
        setLoading(false);
    }
    };

  useEffect(() => {
    if (authUser && (authUser.role === "DISPATCHER" || authUser.role === "OPERATOR" || authUser.role === "ADMIN")) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  const machineName = (id: string) => machines.find((m) => m.id === id)?.name || "Maszyna";

  const filteredBookings = useMemo(() => {
    const startOfDay = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    const today0 = startOfDay(new Date());
    const weekEnd = new Date(today0);
    weekEnd.setDate(weekEnd.getDate() + 7);

    let list = bookings.filter((b) => {
      if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
      const s = new Date(b.start_time);
      const e = new Date(b.end_time);
      if (timeFilter === "TODAY") {
        const t1 = new Date(today0);
        t1.setDate(t1.getDate() + 1);
        return s < t1 && e > today0;
      }
      if (timeFilter === "WEEK") {
        return s < weekEnd && e > today0;
      }
      if (timeFilter === "DAY" && dayFilterIso) {
        const d0 = new Date(`${dayFilterIso}T00:00:00`);
        const d1 = new Date(d0);
        d1.setDate(d1.getDate() + 1);
        return s < d1 && e > d0;
      }
      return true;
    });

    list = [...list].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    return list;
  }, [bookings, statusFilter, timeFilter, dayFilterIso]);

  const selectedBooking = useMemo(
    () => bookings.find((b) => b.id === selectedBookingId) || null,
    [bookings, selectedBookingId]
  );

  const totalRevenueNet = bookings
    .filter((b) => b.status !== "CANCELLED")
    .reduce((sum, b) => sum + b.total_price_net, 0);
  const activeBookingsCount = bookings.filter(
    (b) => b.status === "CONFIRMED" || b.status === "IN_PROGRESS"
  ).length;

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    if (!authUser) return;
    const res = await fetch(`${API_URL}/bookings/${bookingId}/status`, {
      method: "PATCH",
      headers: authHeaders(authUser.token),
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    if (res.ok) {
      show(`Status → ${newStatus}`);
      reload();
    } else {
      show(formatApiError(data.detail, "Błąd statusu."), "error");
    }
  };

  const handleSchedule = async (args: {
    bookingId: string;
    start_time: string;
    end_time: string;
    machine_id: string;
  }) => {
    if (!authUser) return false;
    const res = await fetch(`${API_URL}/bookings/${args.bookingId}/schedule`, {
      method: "PATCH",
      headers: authHeaders(authUser.token),
      body: JSON.stringify({
        start_time: args.start_time,
        end_time: args.end_time,
        machine_id: args.machine_id,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      show("Harmonogram zaktualizowany.");
      await reload();
      return true;
    }
    show(formatApiError(data.detail, "Konflikt / błąd przesunięcia."), "error");
    return false;
  };

  const handleCreateMachine = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    const res = await fetch(`${API_URL}/machines`, {
      method: "POST",
      headers: authHeaders(authUser.token),
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
      show(data.message || "Dodano maszynę.");
      setNewMachineName("");
      reload();
    } else {
      show(formatApiError(data.detail, "Błąd dodawania."), "error");
    }
  };

  const handleCreateBlock = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser || !blockMachineId) return;
    const res = await fetch(`${API_URL}/blocks`, {
      method: "POST",
      headers: authHeaders(authUser.token),
      body: JSON.stringify({
        machine_id: blockMachineId,
        start_time: `${blockDate}T00:00:00`,
        end_time: `${blockDate}T23:59:00`,
        reason: blockReason,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      show(data.message || "Dodano blokadę.");
      reload();
    } else {
      show(formatApiError(data.detail, "Błąd blokady."), "error");
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!authUser) return;
    const res = await fetch(`${API_URL}/blocks/${blockId}`, {
      method: "DELETE",
      headers: authHeaders(authUser.token),
    });
    if (res.ok) {
      show("Usunięto blokadę.");
      reload();
    }
  };

  const handleHandover = async (bookingId: string, protocolType: "PICKUP" | "RETURN") => {
    if (!authUser) return;
    const val = mthInputs[bookingId];
    if (!val || isNaN(Number(val))) {
      show("Wpisz poprawny odczyt mth.", "error");
      return;
    }
    const res = await fetch(`${API_URL}/bookings/${bookingId}/handover`, {
      method: "POST",
      headers: authHeaders(authUser.token),
      body: JSON.stringify({
        protocol_type: protocolType,
        engine_hours_reading: Number(val),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      show(data.message || "Zapisano protokół.");
      setMthInputs((p) => ({ ...p, [bookingId]: "" }));
      reload();
    } else {
      show(formatApiError(data.detail, "Błąd protokołu."), "error");
    }
  };

  const isStaff =
    authUser &&
    (authUser.role === "DISPATCHER" || authUser.role === "OPERATOR" || authUser.role === "ADMIN");

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f5f5f7] flex flex-col">
      <SiteHeader
        locale={locale}
        currency={currency}
        onLocale={setLocale}
        onCurrency={setCurrency}
        authUser={authUser}
        onLoginClick={() => setShowLogin(true)}
        onLogout={() => {
          logout();
          show("Wylogowano.", "info");
        }}
      />

      <main className="flex-1 relative">
        <div className="absolute inset-0 atmosphere opacity-40 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto w-full px-5 sm:px-8 py-10 sm:py-12 space-y-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-semibold">
              Digvo
            </p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              {authUser?.role === "OPERATOR" ? "Panel operatora" : "Panel dyspozytora"}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {authUser?.role === "OPERATOR"
                ? "Odbiory, zwroty i odczyty motogodzin."
                : "Harmonogram floty, statusy zleceń i blokady UDT."}
            </p>
          </div>

            {!ready ? null : !authUser ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-10 text-center">
            <p className="text-sm text-zinc-400">Zaloguj się jako dyspozytor lub operator.</p>
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="mt-5 bg-brand text-black font-semibold px-5 py-2.5 rounded-full"
            >
              {t(locale, "login")}
            </button>
          </div>
        ) : !isStaff ? (
          <div className="rounded-3xl border border-white/[0.06] bg-[#111113] p-10 text-center">
            <p className="text-sm text-zinc-400">To konto nie ma dostępu do panelu floty.</p>
            <Link href="/katalog" className="inline-block mt-5 text-brand text-sm">
              {t(locale, "browse")} →
            </Link>
          </div>
        ) : authUser.role === "OPERATOR" ? (
            loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[1, 2].map((n) => (
                    <div key={n} className="h-48 rounded-3xl skeleton" />
                ))}
                </div>
            ) : bookings.filter((b) => b.status !== "CANCELLED").length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/[0.12] bg-[#111113] p-10 text-center">
                <p className="text-lg font-semibold text-white">Brak aktywnych zleceń</p>
                <p className="mt-2 text-sm text-zinc-400">
                    Gdy dyspozytor przypisze Ci rezerwację, pojawi się tu do odbioru / zwrotu.
                </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 max-w-lg mx-auto w-full pb-24">
                {bookings
                    .filter((b) => b.status !== "CANCELLED")
                    .map((b) => {
                    const pickup = b.protocols.find((p) => p.protocol_type === "PICKUP");
                    const ret = b.protocols.find((p) => p.protocol_type === "RETURN");
                    const st = statusMeta(b.status);
                    const nextAction = !pickup ? "PICKUP" : !ret ? "RETURN" : null;
                    return (
                        <div
                          key={b.id}
                          className="rounded-3xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6 space-y-5"
                        >
                        <div className="flex justify-between gap-3">
                            <div className="min-w-0">
                            <h2 className="text-xl font-semibold text-white leading-tight">
                              {machineName(b.machine_id)}
                            </h2>
                            <p className="flex items-start gap-1.5 text-sm text-zinc-400 mt-2">
                                <PinIcon className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>
                                  {b.delivery_address || "Baza"}
                                  <br />
                                  {new Date(b.start_time).toLocaleString("pl-PL", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                  {" → "}
                                  {new Date(b.end_time).toLocaleString("pl-PL", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                            </p>
                            </div>
                            <span className={`text-xs px-3 py-1.5 rounded-full h-fit shrink-0 ${st.cls}`}>
                            {st.label}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-px bg-white/[0.07] rounded-2xl overflow-hidden">
                            <div className="bg-black/50 p-5">
                            <span className="text-xs text-zinc-500 uppercase tracking-wide">PICKUP</span>
                            <div className="text-emerald-400 font-semibold text-2xl mt-2 tabular-nums">
                                {pickup ? `${pickup.engine_hours_reading}` : "—"}
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5">mth</div>
                            </div>
                            <div className="bg-black/50 p-5">
                            <span className="text-xs text-zinc-500 uppercase tracking-wide">RETURN</span>
                            <div className="text-sky-400 font-semibold text-2xl mt-2 tabular-nums">
                                {ret ? `${ret.engine_hours_reading}` : "—"}
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5">mth</div>
                            </div>
                        </div>

                        {nextAction && (
                            <div className="space-y-3 sticky bottom-4 z-10">
                            <label className="block text-xs text-zinc-500 uppercase tracking-wide">
                              Odczyt motogodzin
                            </label>
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                placeholder="np. 1450.5"
                                value={mthInputs[b.id] || ""}
                                onChange={(e) =>
                                setMthInputs((p) => ({ ...p, [b.id]: e.target.value }))
                                }
                                className={`${INPUT_CLS} w-full rounded-2xl px-5 py-4 text-lg tabular-nums`}
                            />
                            <button
                                type="button"
                                onClick={() => handleHandover(b.id, nextAction)}
                                className="w-full min-h-[52px] bg-brand text-black font-bold text-base rounded-2xl active:scale-[0.99] transition"
                            >
                                Zapisz {nextAction}
                            </button>
                            </div>
                        )}
                        </div>
                    );
                    })}
                </div>
            )
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Przychód netto", value: `${totalRevenueNet.toFixed(0)} zł` },
                { label: "Aktywne zlecenia", value: String(activeBookingsCount) },
                { label: "Blokady UDT", value: String(blocks.length) },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-white/[0.06] bg-[#111113] p-5 relative overflow-hidden"
                >
                  <div className="absolute top-0 inset-x-0 h-1 hazard opacity-80" />
                  <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white tabular-nums tracking-tight">
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            <FleetGantt
              machines={machines}
              bookings={bookings}
              blocks={blocks}
              viewMode={ganttMode}
              anchor={ganttAnchor}
              onAnchorChange={setGanttAnchor}
              onViewModeChange={setGanttMode}
              selectedBookingId={selectedBookingId}
              onSelectBooking={setSelectedBookingId}
              onSchedule={handleSchedule}
              onDayFilter={(iso) => {
                setDayFilterIso(iso);
                setTimeFilter("DAY");
              }}
            />

            {selectedBooking && (
              <div className="rounded-3xl border border-white/[0.08] bg-[#111113] p-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500">Wybrane zlecenie</p>
                  <p className="mt-1 text-white font-semibold">
                    {machineName(selectedBooking.machine_id)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {new Date(selectedBooking.start_time).toLocaleString("pl-PL")} →{" "}
                    {new Date(selectedBooking.end_time).toLocaleString("pl-PL")}
                    {selectedBooking.delivery_address
                      ? ` · ${selectedBooking.delivery_address}`
                      : ""}
                  </p>
                  <p className="mt-1 text-sm tabular-nums text-zinc-300">
                    {selectedBooking.total_price_net} zł · {selectedBooking.status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`${API_URL}/bookings/${selectedBooking.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-white/[0.08] px-3 py-1.5 rounded-full"
                  >
                    PDF
                  </a>
                  {selectedBooking.status === "CONFIRMED" && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedBooking.id, "IN_PROGRESS")}
                      className="text-xs text-brand px-3 py-1.5 rounded-full border border-brand/40"
                    >
                      Start
                    </button>
                  )}
                  {(selectedBooking.status === "CONFIRMED" ||
                    selectedBooking.status === "IN_PROGRESS") && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedBooking.id, "COMPLETED")}
                        className="text-xs text-sky-300 px-3 py-1.5"
                      >
                        Zakończ
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedBooking.id, "CANCELLED")}
                        className="text-xs text-rose-300 px-3 py-1.5"
                      >
                        Anuluj
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedBookingId(null)}
                    className="text-xs text-zinc-500 px-3 py-1.5"
                  >
                    Zamknij
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-white/[0.06] bg-[#111113] p-6">
              <div className="flex flex-wrap justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-white">Harmonogram</h2>
                <div className="flex gap-1.5 flex-wrap">
                  {(
                    [
                      ["TODAY", "Dziś"],
                      ["WEEK", "Ten tydzień"],
                      ["ALL", "Wszystkie"],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setTimeFilter(k);
                        setDayFilterIso(null);
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        timeFilter === k
                          ? "bg-brand text-black border-brand"
                          : "bg-transparent text-zinc-400 border-white/10 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  {timeFilter === "DAY" && dayFilterIso && (
                    <span className="text-xs px-3 py-1.5 rounded-full border border-brand/40 text-brand">
                      Dzień {dayFilterIso}
                    </span>
                  )}
                  {["ALL", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setStatusFilter(k)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        statusFilter === k
                          ? "bg-white text-black border-white"
                          : "bg-transparent text-zinc-400 border-white/10 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      {k === "ALL" ? "Status: wszystkie" : k}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[48rem] text-sm text-left">
                  <thead className="text-[11px] text-zinc-500 uppercase border-b border-white/[0.08]">
                    <tr>
                      <th className="pb-3">Maszyna</th>
                      <th className="pb-3">Termin</th>
                      <th className="pb-3">Kwota</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-sm text-zinc-500">
                          Brak zleceń dla wybranych filtrów.
                        </td>
                      </tr>
                    ) : (
                      filteredBookings.map((b) => {
                        const st = statusMeta(b.status);
                        const selected = selectedBookingId === b.id;
                        return (
                          <tr
                            key={b.id}
                            className={selected ? "bg-white/[0.04]" : undefined}
                            onClick={() => setSelectedBookingId(b.id)}
                          >
                            <td className="py-3 pr-2 text-white">{machineName(b.machine_id)}</td>
                            <td className="py-3 pr-2 text-xs text-zinc-400">
                              {new Date(b.start_time).toLocaleString("pl-PL", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {" → "}
                              {new Date(b.end_time).toLocaleString("pl-PL", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="py-3 pr-2 tabular-nums">{b.total_price_net} zł</td>
                            <td className="py-3 pr-2">
                              <span className={`text-[11px] px-2 py-1 rounded-full ${st.cls}`}>
                                {st.label}
                              </span>
                            </td>
                            <td
                              className="py-3 text-right space-x-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <a
                                href={`${API_URL}/bookings/${b.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-white/[0.08] px-2.5 py-1 rounded-full"
                              >
                                PDF
                              </a>
                              {b.status === "CONFIRMED" && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(b.id, "IN_PROGRESS")}
                                  className="text-xs text-brand px-2 py-1"
                                >
                                  Start
                                </button>
                              )}
                              {(b.status === "CONFIRMED" || b.status === "IN_PROGRESS") && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(b.id, "COMPLETED")}
                                    className="text-xs text-sky-300 px-2 py-1"
                                  >
                                    Zakończ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(b.id, "CANCELLED")}
                                    className="text-xs text-rose-300 px-2 py-1"
                                  >
                                    Anuluj
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <form
                onSubmit={handleCreateMachine}
                className="rounded-3xl border border-white/[0.06] bg-[#111113] p-6 space-y-3"
              >
                <h3 className="font-semibold text-white">Dodaj maszynę</h3>
                <input
                  className={`${INPUT_CLS} rounded-2xl`}
                  placeholder="Model"
                  value={newMachineName}
                  onChange={(e) => setNewMachineName(e.target.value)}
                  required
                />
                <input
                  className={`${INPUT_CLS} rounded-2xl`}
                  value={newMachineCategory}
                  onChange={(e) => setNewMachineCategory(e.target.value)}
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    className={`${INPUT_CLS} rounded-2xl`}
                    value={newMachineRate}
                    onChange={(e) => setNewMachineRate(e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    className={`${INPUT_CLS} rounded-2xl`}
                    value={newMachineDeposit}
                    onChange={(e) => setNewMachineDeposit(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="w-full bg-white text-black font-semibold rounded-full py-3 text-sm">
                  Dodaj
                </button>
              </form>

              <form
                onSubmit={handleCreateBlock}
                className="rounded-3xl border border-white/[0.06] bg-[#111113] p-6 space-y-3"
              >
                <h3 className="font-semibold text-white">Blokada UDT / serwis</h3>
                <select
                  className={`${INPUT_CLS} rounded-2xl`}
                  value={blockMachineId}
                  onChange={(e) => setBlockMachineId(e.target.value)}
                >
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    className={`${INPUT_CLS} rounded-2xl`}
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                    required
                  />
                  <select
                    className={`${INPUT_CLS} rounded-2xl`}
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                  >
                    <option value="MAINTENANCE">Serwis / UDT</option>
                    <option value="VACATION">Postój</option>
                    <option value="SICK_LEAVE">Awaria</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-rose-500/80 text-white font-semibold rounded-full py-3 text-sm">
                  Zablokuj
                </button>
                <ul className="space-y-2 max-h-48 overflow-y-auto scroll-thin pt-2">
                  {blocks.map((bl) => (
                    <li
                      key={bl.id}
                      className="flex justify-between gap-2 text-xs bg-black/40 rounded-xl px-3 py-2"
                    >
                      <span>{machineName(bl.machine_id)}</span>
                      <button type="button" className="text-rose-300" onClick={() => handleDeleteBlock(bl.id)}>
                        Usuń
                      </button>
                    </li>
                  ))}
                </ul>
              </form>
            </div>
          </>
          )}
          </div>
        </main>

        <footer className="border-t border-white/[0.06] mt-auto">
            <div className="hazard h-1 opacity-70" />
            <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
                <div>
                <p className="text-sm text-zinc-300 font-medium">Digvo</p>
                <p className="mt-1">Krótkoterminowy wynajem maszyn z operatorem i transportem.</p>
                </div>
                <div className="flex gap-5">
                <Link href="/katalog" className="hover:text-white transition">
                    Katalog
                </Link>
                <Link href="/moje-rezerwacje" className="hover:text-white transition">
                    Moje rezerwacje
                </Link>
                <Link href="/" className="hover:text-white transition">
                    Start
                </Link>
                </div>
            </div>
            <div className="border-t border-white/[0.06] bg-black">
                <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-zinc-600">
                <p>© 2026 Digvo. Wszelkie prawa zastrzeżone.</p>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                    <span>Platforma demo — praca inżynierska</span>
                    <span>Zdjęcia: Wikimedia Commons (CC)</span>
                    <Link href="/regulamin" className="hover:text-zinc-400 transition">
                      Regulamin
                    </Link>
                    <Link href="/polityka-prywatnosci" className="hover:text-zinc-400 transition">
                      Polityka prywatności
                    </Link>
                </div>
                </div>
            </div>
        </footer>
        <Toast flash={flash} onClose={clear} />
      <LoginModal
        open={showLogin}
        onClose={closeLogin}
        accounts={DEMO_ACCOUNTS}
        error={loginError}
        onClearError={clearLoginError}
        onLogin={performLogin}
        onRegister={performRegister}
        onQuickLogin={quickLogin}
      />
    </div>
  );
}