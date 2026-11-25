"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LoginModal from "../components/LoginModal";
import SiteHeader from "../components/SiteHeader";
import { PinIcon } from "../components/Icons";
import { useAuth } from "../lib/auth";
import { API_URL, authHeaders, formatApiError } from "../lib/api";
import { DEMO_ACCOUNTS, INPUT_CLS, statusMeta, paymentMeta } from "../lib/vendors";
import type { Booking, Machine, UnavailabilityBlock } from "../lib/types";
import { t, type Locale, type Currency } from "../lib/i18n";
import { usePrefs } from "../lib/usePrefs";
import Toast from "../components/Toast";
import { useFlash } from "../lib/flash";
import FleetGantt from "../components/FleetGantt";
import SoftSelect from "../components/SoftSelect";
import { machineImageUrl } from "../lib/machineImages";

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
    performVendorRegister,
    quickLogin,
  } = useAuth();

  const { locale, setLocale, currency, setCurrency } = usePrefs();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<UnavailabilityBlock[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [timeFilter, setTimeFilter] = useState<"ALL" | "TODAY" | "WEEK" | "DAY">("TODAY");
  const [dayFilterIso, setDayFilterIso] = useState<string | null>(null);
  const [ganttMode, setGanttMode] = useState<"week" | "day">("week");
  const [ganttAnchor, setGanttAnchor] = useState<Date | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [extendDaysPanel, setExtendDaysPanel] = useState("1");
  const [dispatcherTab, setDispatcherTab] = useState<"schedule" | "fleet">("schedule");
  const [mthInputs, setMthInputs] = useState<Record<string, string>>({});
  const [handoverPhotos, setHandoverPhotos] = useState<Record<string, string>>({});
  const [handoverSigs, setHandoverSigs] = useState<Record<string, string>>({});

  const [blockMachineId, setBlockMachineId] = useState("");
  const [blockDate, setBlockDate] = useState("");
  const [blockReason, setBlockReason] = useState("MAINTENANCE");
  const [newMachineName, setNewMachineName] = useState("");
  const [newMachineCategory, setNewMachineCategory] = useState("Minikoparki");
  const [newMachineRate, setNewMachineRate] = useState("450");
  const [newMachineDeposit, setNewMachineDeposit] = useState("1000");
  const [newMachineBuffer, setNewMachineBuffer] = useState("2");
  const [newMachineTransport, setNewMachineTransport] = useState("14");
  const [newMachinePhoto, setNewMachinePhoto] = useState<string | null>(null);
  const [newMachinePhotoName, setNewMachinePhotoName] = useState("");
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Machine | null>(null);

  const [loading, setLoading] = useState(false);
  const { flash, show, clear } = useFlash();

  useEffect(() => {
    setGanttAnchor(new Date());
  }, []);

  const reload = async () => {
    if (!authUser?.token) return;
    setLoading(true);
    try {
      const headers = authHeaders(authUser.token);
      const [mRes, bRes, blRes] = await Promise.all([
        fetch(`${API_URL}/machines/fleet`, { headers }),
        fetch(`${API_URL}/bookings`, { headers }),
        fetch(`${API_URL}/blocks`, { headers }),
      ]);
      const mData = await mRes.json();
      const bData = await bRes.json();
      const blData = await blRes.json();

      let machinesList: Machine[] = Array.isArray(mData) ? mData : [];
      if (authUser.role !== "ADMIN" && authUser.organization_id) {
        machinesList = machinesList.filter(
          (m) => m.organization_id === authUser.organization_id
        );
      }

      setMachines(machinesList);
      setBookings(Array.isArray(bData) ? bData : []);
      setBlocks(Array.isArray(blData) ? blData : []);
      if (machinesList[0] && !blockMachineId) {
        setBlockMachineId(machinesList[0].id);
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

  useEffect(() => {
    const d = new Date();
    setBlockDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }, []);

  useEffect(() => {
    if (!deleteTarget) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeleteTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [deleteTarget]);

  const machineName = (id: string) => machines.find((m) => m.id === id)?.name || "Maszyna";

  const filteredBookings = useMemo(() => {
    const startOfDay = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    if (!ganttAnchor) return [];
    const today0 = startOfDay(ganttAnchor);
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
  }, [bookings, statusFilter, timeFilter, dayFilterIso, ganttAnchor]);

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

  const toLocalIso = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const extendSelected = async () => {
    if (!selectedBooking) return;
    if (
      selectedBooking.status !== "CONFIRMED" &&
      selectedBooking.status !== "IN_PROGRESS"
    ) {
      show("Można przedłużyć tylko aktywne zlecenie.", "error");
      return;
    }
    const days = Math.min(7, Math.max(1, Number(extendDaysPanel || "1")));
    const start = new Date(selectedBooking.start_time);
    const end = new Date(selectedBooking.end_time);
    end.setDate(end.getDate() + days);
    const ok = await handleSchedule({
      bookingId: selectedBooking.id,
      start_time: toLocalIso(start),
      end_time: toLocalIso(end),
      machine_id: selectedBooking.machine_id,
    });
    if (ok) show(`Przedłużono o ${days} dni.`);
  };

  const setPayment = async (bookingId: string, payment_status: string) => {
    if (!authUser) return;
    const res = await fetch(`${API_URL}/bookings/${bookingId}/payment`, {
      method: "PATCH",
      headers: authHeaders(authUser.token),
      body: JSON.stringify({ payment_status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      show(formatApiError(data.detail, "Błąd płatności."), "error");
      return;
    }
    show("Zaktualizowano status kaucji.", "success");
    await reload();
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

  const resetMachineForm = () => {
  setEditingMachineId(null);
  setNewMachineName("");
  setNewMachineCategory("Minikoparki");
  setNewMachineRate("450");
  setNewMachineDeposit("1000");
  setNewMachineBuffer("2");
  setNewMachineTransport("14");
  setNewMachinePhoto(null);
  setNewMachinePhotoName("");
};

const startEditMachine = (m: Machine) => {
  setEditingMachineId(m.id);
  setNewMachineName(m.name);
  setNewMachineCategory(m.category);
  setNewMachineRate(String(m.daily_rate_net));
  setNewMachineDeposit(String(m.deposit_amount));
  setNewMachineBuffer(String(m.service_buffer_hours));
  setNewMachineTransport(String(m.transport_rate_per_km));
  setNewMachinePhoto(m.image_url || null);
  setNewMachinePhotoName(m.image_url ? "obecne zdjęcie" : "");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const handleSaveMachine = async (e: FormEvent) => {
  e.preventDefault();
  if (!authUser) return;
  const body = {
    name: newMachineName,
    category: newMachineCategory,
    daily_rate_net: Number(newMachineRate),
    deposit_amount: Number(newMachineDeposit),
    transport_rate_per_km: Number(newMachineTransport),
    service_buffer_hours: Number(newMachineBuffer),
    image_url: newMachinePhoto,
    ...(editingMachineId
  ? {}
  : { is_published: true }),
  };
  const url = editingMachineId
    ? `${API_URL}/machines/${editingMachineId}`
    : `${API_URL}/machines`;
  const res = await fetch(url, {
    method: editingMachineId ? "PATCH" : "POST",
    headers: authHeaders(authUser.token),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (res.ok) {
    show(data.message || (editingMachineId ? "Zapisano." : "Dodano maszynę."));
    resetMachineForm();
    reload();
  } else {
    show(formatApiError(data.detail, "Błąd zapisu maszyny."), "error");
  }
};

const togglePublishMachine = async (m: Machine) => {
  if (!authUser) return;
  const res = await fetch(`${API_URL}/machines/${m.id}`, {
    method: "PATCH",
    headers: authHeaders(authUser.token),
    body: JSON.stringify({ is_published: !(m.is_published !== false) }),
  });
  const data = await res.json();
  if (res.ok) {
    show(m.is_published === false ? "Opublikowano w katalogu." : "Wycofano z katalogu.");
    reload();
  } else {
    show(formatApiError(data.detail, "Błąd publikacji."), "error");
  }
};

const handleDeleteMachine = async (m: Machine) => {
  if (!authUser) return;
  const res = await fetch(`${API_URL}/machines/${m.id}`, {
    method: "DELETE",
    headers: authHeaders(authUser.token),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    show(data.message || "Usunięto maszynę.");
    if (editingMachineId === m.id) resetMachineForm();
    setDeleteTarget(null);
    reload();
  } else {
    show(formatApiError(data.detail, "Nie udało się usunąć."), "error");
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

  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxW = 960;
          const scale = Math.min(1, maxW / img.width);
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          const ctx = c.getContext("2d");
          if (!ctx) return reject(new Error("canvas"));
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.65));
        };
        img.onerror = reject;
        img.src = String(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const readSignature = (canvas: HTMLCanvasElement | null): string | null => {
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let ink = false;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 0) {
        ink = true;
        break;
      }
    }
    if (!ink) return null;
    return canvas.toDataURL("image/png");
  };

 const handleHandover = async (bookingId: string, protocolType: "PICKUP" | "RETURN") => {
    if (!authUser) return;
    const val = mthInputs[bookingId];
    if (!val || isNaN(Number(val))) {
      show("Wpisz poprawny odczyt mth.", "error");
      return;
    }
    const photo = handoverPhotos[bookingId];
    const sig = handoverSigs[bookingId];
    if (!photo) {
      show("Dodaj zdjęcie licznika.", "error");
      return;
    }
    if (!sig) {
      show("Złóż podpis na polu poniżej.", "error");
      return;
    }
    const res = await fetch(`${API_URL}/bookings/${bookingId}/handover`, {
      method: "POST",
      headers: authHeaders(authUser.token),
      body: JSON.stringify({
        protocol_type: protocolType,
        engine_hours_reading: Number(val),
        photo_data_url: photo,
        signature_data_url: sig,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      show(data.message || "Zapisano protokół.");
      setMthInputs((p) => ({ ...p, [bookingId]: "" }));
      setHandoverPhotos((p) => {
        const n = { ...p };
        delete n[bookingId];
        return n;
      });
      setHandoverSigs((p) => {
        const n = { ...p };
        delete n[bookingId];
        return n;
      });
      reload();
    } else {
      show(formatApiError(data.detail, "Błąd protokołu."), "error");
    }
  };

  const operatorJobs = useMemo(() => {
  return bookings
    .filter((b) => b.status !== "CANCELLED")
    .map((b) => {
      const pickup = b.protocols.find((p) => p.protocol_type === "PICKUP");
      const ret = b.protocols.find((p) => p.protocol_type === "RETURN");
      const nextAction: "PICKUP" | "RETURN" | null = !pickup
        ? "PICKUP"
        : !ret
          ? "RETURN"
          : null;
      return { b, pickup, ret, nextAction };
    })
    .sort((a, c) => {
      const pa = a.nextAction ? 0 : 1;
      const pc = c.nextAction ? 0 : 1;
      if (pa !== pc) return pa - pc;
      return (
        new Date(a.b.start_time).getTime() - new Date(c.b.start_time).getTime()
      );
    });
}, [bookings]);

const pendingPickups = operatorJobs.filter((j) => j.nextAction === "PICKUP").length;
const pendingReturns = operatorJobs.filter((j) => j.nextAction === "RETURN").length;
const fleetMachines = useMemo(
  () => machines.filter((m) => !/^test\s/i.test(m.name)),
  [machines]
);

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
            ) : operatorJobs.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/[0.12] bg-[#111113] p-10 text-center">
                <p className="text-lg font-semibold text-white">Brak aktywnych zleceń</p>
                <p className="mt-2 text-sm text-zinc-400">
                    Gdy dyspozytor przypisze Ci rezerwację, pojawi się tu do odbioru / zwrotu.
                </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 max-w-lg mx-auto w-full pb-24">
                {(pendingPickups > 0 || pendingReturns > 0) && (
                  <p className="text-center text-sm text-zinc-400">
                    {pendingPickups > 0 && (
                      <span className="text-brand font-medium">{pendingPickups} do odbioru</span>
                    )}
                    {pendingPickups > 0 && pendingReturns > 0 && " · "}
                    {pendingReturns > 0 && (
                      <span className="text-sky-300 font-medium">{pendingReturns} do zwrotu</span>
                    )}
                  </p>
                )}
                {operatorJobs.map(({ b, pickup, ret, nextAction }, idx) => {
                    const st = statusMeta(b.status, locale);
                    const isNext =
                      nextAction != null &&
                      operatorJobs.findIndex((j) => j.nextAction) === idx;
                    return (
                        <div
                          key={b.id}
                          className={`rounded-3xl border bg-[#111113] p-5 sm:p-6 space-y-5 ${
                            isNext
                              ? "border-brand/50 ring-1 ring-brand/30"
                              : "border-white/[0.08]"
                          }`}
                        >
                        <div className="flex justify-between gap-3">
                            <div className="min-w-0">
                            {isNext && (
                              <p className="text-[11px] uppercase tracking-wider text-brand font-semibold mb-1">
                                Następne
                              </p>
                            )}
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
                            <span className="text-xs text-zinc-500 uppercase tracking-wide">Odbiór</span>
                            <div className="text-emerald-400 font-semibold text-2xl mt-2 tabular-nums">
                                {pickup ? `${pickup.engine_hours_reading}` : "—"}
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5">mth</div>
                            </div>
                            <div className="bg-black/50 p-5">
                            <span className="text-xs text-zinc-500 uppercase tracking-wide">Zwrot</span>
                            <div className="text-sky-400 font-semibold text-2xl mt-2 tabular-nums">
                                {ret ? `${ret.engine_hours_reading}` : "—"}
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5">mth</div>
                            </div>
                        </div>

                        {nextAction && (
                            <div className={`space-y-3 ${isNext ? "sticky bottom-4 z-10" : ""}`}>
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

                                <div className="space-y-2">
                                  <label className="block text-xs text-zinc-500 uppercase tracking-wide">
                                    Zdjęcie licznika
                                  </label>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
                                    onChange={async (e) => {
                                      const f = e.target.files?.[0];
                                      if (!f) return;
                                      try {
                                        const url = await compressImage(f);
                                        setHandoverPhotos((p) => ({ ...p, [b.id]: url }));
                                      } catch {
                                        show("Nie udało się wczytać zdjęcia.", "error");
                                      }
                                    }}
                                  />
                                  {handoverPhotos[b.id] && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={handoverPhotos[b.id]}
                                      alt="Licznik"
                                      className="mt-2 w-full max-h-40 object-cover rounded-xl border border-white/10"
                                    />
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <label className="text-xs text-zinc-500 uppercase tracking-wide">
                                      Podpis
                                    </label>
                                    <button
                                      type="button"
                                      className="text-xs text-zinc-400"
                                      onClick={() => {
                                        const c = document.getElementById(
                                          `sig-${b.id}`
                                        ) as HTMLCanvasElement | null;
                                        const ctx = c?.getContext("2d");
                                        if (c && ctx) {
                                          ctx.clearRect(0, 0, c.width, c.height);
                                        }
                                        setHandoverSigs((p) => {
                                          const n = { ...p };
                                          delete n[b.id];
                                          return n;
                                        });
                                      }}
                                    >
                                      Wyczyść
                                    </button>
                                  </div>
                                  <canvas
                                    id={`sig-${b.id}`}
                                    width={360}
                                    height={140}
                                    className="w-full h-36 rounded-xl bg-white touch-none"
                                    onPointerDown={(e) => {
                                      const c = e.currentTarget;
                                      const ctx = c.getContext("2d");
                                      if (!ctx) return;
                                      c.setPointerCapture(e.pointerId);
                                      ctx.strokeStyle = "#111";
                                      ctx.lineWidth = 2.5;
                                      ctx.lineCap = "round";
                                      ctx.beginPath();
                                      const r = c.getBoundingClientRect();
                                      ctx.moveTo(
                                        ((e.clientX - r.left) / r.width) * c.width,
                                        ((e.clientY - r.top) / r.height) * c.height
                                      );
                                    }}
                                    onPointerMove={(e) => {
                                      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                                      const c = e.currentTarget;
                                      const ctx = c.getContext("2d");
                                      if (!ctx) return;
                                      const r = c.getBoundingClientRect();
                                      ctx.lineTo(
                                        ((e.clientX - r.left) / r.width) * c.width,
                                        ((e.clientY - r.top) / r.height) * c.height
                                      );
                                      ctx.stroke();
                                    }}
                                    onPointerUp={(e) => {
                                      const c = e.currentTarget;
                                      c.releasePointerCapture(e.pointerId);
                                      const data = readSignature(c);
                                      if (data) {
                                        setHandoverSigs((p) => ({ ...p, [b.id]: data }));
                                      }
                                    }}
                                  />
                                </div>
                            
                            <button
                                type="button"
                                onClick={() => handleHandover(b.id, nextAction)}
                                className="w-full min-h-[52px] bg-brand text-black font-bold text-base rounded-2xl active:scale-[0.99] transition"
                            >
                                {nextAction === "PICKUP" ? "Zapisz odbiór" : "Zapisz zwrot"}
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
              
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex rounded-full border border-white/10 p-0.5">
                  {(
                    [
                      ["schedule", "Harmonogram"],
                      ["fleet", "Flota i blokady"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDispatcherTab(id)}
                      className={`text-sm px-4 py-2 rounded-full transition ${
                        dispatcherTab === id
                          ? "bg-white text-black font-semibold"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-500">
                  {dispatcherTab === "schedule"
                    ? "Plan dnia: Gantt + lista zleceń"
                    : "Dodawanie maszyn i blokady UDT / serwis"}
                </p>
              </div>

              {dispatcherTab === "schedule" && (
              <>

            {ganttAnchor ? (
            <FleetGantt
              machines={machines.filter((m) => !/^test\s/i.test(m.name))}
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
            ) : (
              <div className="h-48 rounded-3xl skeleton" />
            )}

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
                   {selectedBooking.total_price_net} zł ·{" "}
                   {statusMeta(selectedBooking.status, locale).label}
                 </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`${API_URL}/bookings/${selectedBooking.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs font-medium bg-white/[0.08] hover:bg-white hover:text-black border border-white/[0.12] px-2.5 py-1.5 rounded-full transition"
                  >
                    PDF
                  </a>
                  {(selectedBooking.status === "CONFIRMED" ||
                    selectedBooking.status === "IN_PROGRESS") && (
                    <div className="inline-flex items-center gap-1.5">
                      <div className="w-[7.5rem]">
                        <SoftSelect
                          size="sm"
                          value={extendDaysPanel}
                          onChange={setExtendDaysPanel}
                          options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({
                            value: String(n),
                            label: n === 1 ? "1 dzień" : `${n} dni`,
                          }))}
                          ariaLabel="Przedłuż o"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={extendSelected}
                        className="inline-flex items-center text-xs font-medium border border-brand/40 text-brand hover:bg-brand hover:text-black px-2.5 py-1.5 rounded-full transition"
                      >
                        Przedłuż
                      </button>
                    </div>
                  )}
                  {selectedBooking.status === "CONFIRMED" && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedBooking.id, "IN_PROGRESS")}
                      className="inline-flex items-center text-xs font-semibold border border-brand/50 text-brand hover:bg-brand hover:text-black px-2.5 py-1.5 rounded-full transition"
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
                        className="inline-flex items-center text-xs font-medium border border-sky-500/40 text-sky-300 hover:bg-sky-400 hover:text-black px-2.5 py-1.5 rounded-full transition"
                      >
                        Zakończ
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedBooking.id, "CANCELLED")}
                        className="inline-flex items-center text-xs font-medium border border-rose-500/40 text-rose-300 hover:bg-rose-400 hover:text-black px-2.5 py-1.5 rounded-full transition"
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
                      {k === "ALL" ? t(locale, "statusFilterAll") : statusMeta(k, locale).label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[48rem] text-sm text-left">
                  <thead className="text-[11px] text-zinc-500 uppercase border-b border-white/[0.08]">
                    <tr>
                      <th className="pb-3 pl-3">Maszyna</th>
                      <th className="pb-3">Termin</th>
                      <th className="pb-3">Kwota</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 pl-4 pr-3 text-right">Akcje</th>
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
                        const st = statusMeta(b.status, locale);
                        const selected = selectedBookingId === b.id;
                        return (
                          <tr
                            key={b.id}
                            className={`${selected ? "bg-white/[0.04]" : ""} cursor-pointer hover:bg-white/[0.03]`}
                            onClick={() => setSelectedBookingId(b.id)}
                          >
                            <td className="py-3 pl-3 pr-2 align-middle text-white">{machineName(b.machine_id)}</td>
                            <td className="py-3 pr-2 align-middle text-xs text-zinc-400">
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
                            <td className="py-3 pr-2 align-middle tabular-nums">{b.total_price_net} zł</td>
                            <td className="py-3 pr-6 align-middle">
                              <div className="flex flex-col gap-1 items-start">
                                <span className={`text-[11px] px-2 py-1 rounded-full ${st.cls}`}>
                                  {st.label}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${paymentMeta(b.payment_status, locale).cls}`}>
                                  {paymentMeta(b.payment_status, locale).label}
                                </span>
                              </div>
                            </td>
                              <td className="py-3 pl-4 pr-3 align-middle text-right">
                                <div
                                  className="inline-flex flex-wrap justify-end gap-1.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                <a
                                  href={`${API_URL}/bookings/${b.id}/pdf`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-xs font-medium bg-white/[0.08] hover:bg-white hover:text-black border border-white/[0.12] px-2.5 py-1.5 rounded-full transition"
                                >
                                  PDF
                                </a>

                                {b.payment_status !== "DEPOSIT_CONFIRMED" && b.status !== "CANCELLED" && (
                                  <button
                                    type="button"
                                    onClick={() => setPayment(b.id, "DEPOSIT_CONFIRMED")}
                                    className="inline-flex items-center text-xs font-medium border border-emerald-500/40 text-emerald-300 hover:bg-emerald-400 hover:text-black px-2.5 py-1.5 rounded-full transition"
                                  >
                                    Potwierdź kaucję
                                  </button>
                                )}
                                {b.status === "CONFIRMED" && (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(b.id, "IN_PROGRESS")}
                                    className="inline-flex items-center text-xs font-semibold border border-brand/50 text-brand hover:bg-brand hover:text-black px-2.5 py-1.5 rounded-full transition"
                                  >
                                    Start
                                  </button>
                                )}
                                {(b.status === "CONFIRMED" || b.status === "IN_PROGRESS") && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleStatusChange(b.id, "COMPLETED")}
                                      className="inline-flex items-center text-xs font-medium border border-sky-500/40 text-sky-300 hover:bg-sky-400 hover:text-black px-2.5 py-1.5 rounded-full transition"
                                    >
                                      Zakończ
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStatusChange(b.id, "CANCELLED")}
                                      className="inline-flex items-center text-xs font-medium border border-rose-500/40 text-rose-300 hover:bg-rose-400 hover:text-black px-2.5 py-1.5 rounded-full transition"
                                    >
                                      Anuluj
                                    </button>
                                  </>
                                )}
                                </div>
                              </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </>
            )}

            {dispatcherTab === "fleet" && (
            <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <form
                onSubmit={handleSaveMachine}
                className="rounded-3xl border border-white/[0.06] bg-[#111113] p-6 space-y-3"
              >
                <h3 className="font-semibold text-white">
                  {editingMachineId ? "Edytuj maszynę" : "Dodaj maszynę"}
                </h3>

                <label className="block">
                  <span className="block text-[11px] text-zinc-500 mb-1.5 px-1">Model</span>
                  <input
                    className={`${INPUT_CLS} rounded-full`}
                    placeholder="np. Minikoparka Bobcat E27z"
                    value={newMachineName}
                    onChange={(e) => setNewMachineName(e.target.value)}
                    required
                  />
                </label>

                <label className="block">
                  <span className="block text-[11px] text-zinc-500 mb-1.5 px-1">Kategoria</span>
                  <SoftSelect
                    ariaLabel="Kategoria maszyny"
                    className="w-full"
                    value={newMachineCategory}
                    onChange={setNewMachineCategory}
                    options={[
                      { value: "Minikoparki", label: "Minikoparki" },
                      { value: "Koparki gąsienicowe", label: "Koparki gąsienicowe" },
                      { value: "Koparki kołowe", label: "Koparki kołowe" },
                      { value: "Koparkoładowarki", label: "Koparkoładowarki" },
                      { value: "Ładowarki", label: "Ładowarki" },
                      { value: "Ładowarki kołowe", label: "Ładowarki kołowe" },
                      { value: "Ładowarki teleskopowe", label: "Ładowarki teleskopowe" },
                    ]}
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-[11px] text-zinc-500 mb-1.5 px-1">Stawka / doba (zł)</span>
                    <input
                      type="number"
                      className={`${INPUT_CLS} rounded-full`}
                      value={newMachineRate}
                      onChange={(e) => setNewMachineRate(e.target.value)}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] text-zinc-500 mb-1.5 px-1">Kaucja (zł)</span>
                    <input
                      type="number"
                      className={`${INPUT_CLS} rounded-full`}
                      value={newMachineDeposit}
                      onChange={(e) => setNewMachineDeposit(e.target.value)}
                      required
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="block text-[11px] text-zinc-500 mb-1.5 px-1">Bufor serwisowy (h)</span>
                  <input
                    type="number"
                    className={`${INPUT_CLS} rounded-full`}
                    value={newMachineBuffer}
                    onChange={(e) => setNewMachineBuffer(e.target.value)}
                    required
                  />
                </label>
                  
                  <label className="block">
                    <span className="block text-[11px] text-zinc-500 mb-1.5 px-1">Transport zł/km</span>
                    <input
                      type="number"
                      className={`${INPUT_CLS} rounded-full`}
                      value={newMachineTransport}
                      onChange={(e) => setNewMachineTransport(e.target.value)}
                      required
                    />
                  </label>

                  <div className="space-y-2">
                    <span className="block text-[11px] text-zinc-500 px-1">Zdjęcie (opcjonalnie)</span>
                    {newMachinePhoto ? (
                      <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] aspect-[16/10] bg-black/40">
                        <img src={newMachinePhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setNewMachinePhoto(null);
                            setNewMachinePhotoName("");
                          }}
                          className="absolute top-2 right-2 text-xs bg-black/70 hover:bg-black text-white px-2.5 py-1 rounded-full"
                        >
                          Usuń
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 hover:border-white/30 bg-black/30 px-4 py-8 cursor-pointer transition">
                        <span className="text-sm text-zinc-300">Wybierz zdjęcie</span>
                        <span className="text-[11px] text-zinc-500">JPG / PNG, kompresja automatyczna</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file) return;
                            try {
                              const dataUrl = await compressImage(file);
                              setNewMachinePhoto(dataUrl);
                              setNewMachinePhotoName(file.name);
                            } catch {
                              show("Nie udało się wczytać zdjęcia.", "error");
                            }
                          }}
                        />
                      </label>
                    )}
                    {newMachinePhotoName && (
                      <p className="text-[11px] text-zinc-500 truncate px-1">{newMachinePhotoName}</p>
                    )}
                  </div>

                <div className="flex gap-2">
                  {editingMachineId && (
                    <button
                      type="button"
                      onClick={resetMachineForm}
                      className="flex-1 border border-white/15 text-zinc-300 font-medium rounded-full py-3 text-sm"
                    >
                      Anuluj
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-[2] bg-white text-black font-semibold rounded-full py-3 text-sm"
                  >
                    {editingMachineId ? "Zapisz zmiany" : "Dodaj"}
                  </button>
                </div>
              </form>

              <form
                onSubmit={handleCreateBlock}
                className="rounded-3xl border border-white/[0.06] bg-[#111113] p-6 space-y-3"
              >
                <h3 className="font-semibold text-white">Blokada UDT / serwis</h3>
                <label className="block">
                  <span className="block text-[11px] text-zinc-500 mb-1.5 px-1">Maszyna</span>
                  <SoftSelect
                    ariaLabel="Maszyna do blokady"
                    className="w-full"
                    value={blockMachineId || ""}
                    onChange={setBlockMachineId}
                    options={
                      fleetMachines.length === 0
                        ? [{ value: "", label: "Brak maszyn — dodaj po lewej" }]
                        : fleetMachines.map((m) => ({ value: m.id, label: m.name }))
                    }
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-[11px] text-zinc-500 mb-1.5 px-1">Data</span>
                    <input
                      type="date"
                      className={`${INPUT_CLS} rounded-full`}
                      value={blockDate}
                      onChange={(e) => setBlockDate(e.target.value)}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] text-zinc-500 mb-1.5 px-1">Typ</span>
                    <SoftSelect
                      ariaLabel="Powód blokady"
                      className="w-full"
                      value={blockReason}
                      onChange={setBlockReason}
                      options={[
                        { value: "MAINTENANCE", label: "Serwis / UDT" },
                        { value: "VACATION", label: "Postój" },
                        { value: "SICK_LEAVE", label: "Awaria" },
                      ]}
                    />
                  </label>
                </div>
                <button type="submit" className="w-full bg-rose-500/80 text-white font-semibold rounded-full py-3 text-sm">
                  Zablokuj
                </button>
                <ul className="space-y-2 max-h-48 overflow-y-auto scroll-thin pt-2">
                  {blocks.length === 0 ? (
                    <li className="text-xs text-zinc-500 px-1 py-2">
                      Brak aktywnych blokad.
                    </li>
                  ) : (
                    blocks.map((bl) => (
                    <li
                      key={bl.id}
                      className="flex items-start justify-between gap-3 text-xs bg-black/40 rounded-2xl px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-zinc-200 truncate">{machineName(bl.machine_id)}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {new Date(bl.start_time).toLocaleDateString("pl-PL")}
                          {" · "}
                          {bl.reason === "MAINTENANCE"
                            ? "Serwis / UDT"
                            : bl.reason === "VACATION"
                              ? "Postój"
                              : bl.reason === "SICK_LEAVE"
                                ? "Awaria"
                                : bl.reason}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 inline-flex items-center text-xs font-medium border border-rose-500/40 text-rose-300 hover:bg-rose-400 hover:text-black px-2.5 py-1.5 rounded-full transition"
                        onClick={() => handleDeleteBlock(bl.id)}
                      >
                        Usuń
                      </button>
                    </li>
                    ))
                  )}
                </ul>
              </form>
              </div>

                  <div className="mt-6 rounded-3xl border border-white/[0.06] bg-[#111113] p-6">
                    <div className="flex items-baseline justify-between gap-3 mb-4">
                      <h3 className="font-semibold text-white">Maszyny we flocie</h3>
                      <p className="text-[11px] text-zinc-500">
                        {fleetMachines.filter((m) => m.is_published !== false).length}/{fleetMachines.length} w katalogu
                      </p>
                    </div>
                    {fleetMachines.length === 0 ? (
                      <p className="text-sm text-zinc-500 py-6 text-center">Brak maszyn — dodaj po lewej.</p>
                    ) : (
                      <ul className="space-y-2">
                        {fleetMachines.map((m) => {
                          const published = m.is_published !== false;
                          const hasHistory =
                            bookings.some((b) => b.machine_id === m.id) ||
                            blocks.some((bl) => bl.machine_id === m.id);
                          return (
                            <li
                              key={m.id}
                              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl bg-black/40 border border-white/[0.06] p-3"
                            >
                              <div className="w-full sm:w-24 h-16 rounded-xl overflow-hidden bg-[#1a1a1c] shrink-0">
                                <img
                                  src={machineImageUrl(m)}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-white font-medium truncate">{m.name}</p>
                                <p className="text-[11px] text-zinc-500 mt-0.5">
                                  {m.category} · {m.daily_rate_net} zł/doba
                                  {" · "}
                                  <span className={published ? "text-emerald-400" : "text-amber-400"}>
                                    {published ? "w katalogu" : "ukryta"}
                                  </span>
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                                <button
                                  type="button"
                                  onClick={() => startEditMachine(m)}
                                  className="inline-flex items-center text-xs font-medium border border-white/20 text-zinc-200 hover:bg-white hover:text-black px-2.5 py-1.5 rounded-full transition"
                                >
                                  Edytuj
                                </button>
                                <button
                                  type="button"
                                  onClick={() => togglePublishMachine(m)}
                                  className={`inline-flex items-center text-xs font-medium border px-2.5 py-1.5 rounded-full transition ${
                                    published
                                      ? "border-amber-500/40 text-amber-300 hover:bg-amber-400 hover:text-black"
                                      : "border-emerald-500/40 text-emerald-300 hover:bg-emerald-400 hover:text-black"
                                  }`}
                                >
                                  {published ? "Ukryj" : "Publikuj"}
                                </button>
                                <button
                                  type="button"
                                  disabled={hasHistory}
                                  title={
                                    hasHistory
                                      ? "Ma zlecenia lub blokady — najpierw ukryj w katalogu (nie da się usunąć z historią)."
                                      : "Usuń trwale z floty"
                                  }
                                  onClick={() => setDeleteTarget(m)}
                                  className="inline-flex items-center text-xs font-medium border border-rose-500/40 text-rose-300 hover:bg-rose-400 hover:text-black px-2.5 py-1.5 rounded-full transition disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-rose-300 disabled:cursor-not-allowed"
                                >
                                  Usuń
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

              </>
              )}
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
                <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-zinc-500">
                <p>© 2026 Digvo. Wszelkie prawa zastrzeżone.</p>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                    <span>Marketplace wynajmu maszyn · Bydgoszcz</span>
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

          {deleteTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
              <button
                type="button"
                aria-label="Zamknij"
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => setDeleteTarget(null)}
              />
              <div className="relative w-full max-w-sm rounded-3xl border border-white/[0.1] bg-[#121214] p-6 shadow-2xl shadow-black/60">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Usuwanie z floty</p>
                <h3 className="mt-2 text-lg font-semibold text-white leading-snug">
                  Usunąć „{deleteTarget.name}”?
                </h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Maszyna zniknie z floty. Jeśli ma historię rezerwacji, lepiej najpierw ją ukryć w katalogu.
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 border border-white/15 text-zinc-300 font-medium rounded-full py-3 text-sm hover:bg-white/[0.06] transition"
                  >
                    Anuluj
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMachine(deleteTarget)}
                    className="flex-[1.2] bg-rose-500 hover:bg-rose-400 text-white font-semibold rounded-full py-3 text-sm transition"
                  >
                    Usuń
                  </button>
                </div>
              </div>
            </div>
          )}  

      <LoginModal
        open={showLogin}
        onClose={closeLogin}
        accounts={DEMO_ACCOUNTS}
        error={loginError}
        onClearError={clearLoginError}
        onLogin={performLogin}
        onRegister={performRegister}
        onVendorRegister={performVendorRegister}
        onQuickLogin={quickLogin}
      />
    </div>
  );
}