"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import LoginModal from "../components/LoginModal";
import SiteHeader from "../components/SiteHeader";
import {
  CalendarIcon,
  FileIcon,
  HardHatIcon,
  MachineGlyph,
  PinIcon,
  SpinnerIcon,
  TruckIcon,
} from "../components/Icons";
import { useAuth } from "../lib/auth";
import { API_URL, authHeaders, formatApiError } from "../lib/api";
import { DEMO_ACCOUNTS, INPUT_CLS, SITE_PRESETS, resolveMachineVendor } from "../lib/vendors";
import type { BookingQuote, Machine } from "../lib/types";
import { t, formatMoney, type Locale, type Currency } from "../lib/i18n";
import { machineImageUrl } from "../lib/machineImages";
import Toast from "../components/Toast";
import { useFlash } from "../lib/flash";
import BusyCalendar from "../components/BusyCalendar";

  

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
      className={`flex items-center gap-3.5 p-4 rounded-2xl border cursor-pointer transition ${
        checked ? "bg-brand/[0.06] border-brand/35" : "bg-black/40 border-white/[0.08] hover:border-white/[0.18]"
      }`}
    >
      <span
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition ${
          checked ? "bg-brand text-black" : "bg-white/[0.06] text-zinc-400"
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
        className="relative w-[3.1rem] h-7 rounded-full bg-zinc-700 peer-checked:bg-brand transition-colors shrink-0 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-6 after:h-6 after:rounded-full after:bg-white after:shadow-md after:transition-transform after:duration-200 peer-checked:after:translate-x-[1.2rem]"
      />
    </label>
  );
}

function BookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const machineId = searchParams.get("machine");

  const {
    authUser,
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

  const [locale, setLocale] = useState<Locale>("pl");
  const [currency, setCurrency] = useState<Currency>("PLN");
  const [eurRate, setEurRate] = useState(4.25);
  const [machine, setMachine] = useState<Machine | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("2027-01-12");
  const [endDate, setEndDate] = useState("2027-01-12");
  const [calMonth, setCalMonth] = useState(() => new Date(2027, 0, 1));
  const [busyDates, setBusyDates] = useState<Set<string>>(new Set());
  const [startHour, setStartHour] = useState("08:00");
  const [endHour, setEndHour] = useState("16:00");
  const [withOperator, setWithOperator] = useState(true);
  const [withTransport, setWithTransport] = useState(true);
  const [siteId, setSiteId] = useState(SITE_PRESETS[0].id);
  const [address, setAddress] = useState(SITE_PRESETS[0].address);
  const [deliveryLat, setDeliveryLat] = useState(SITE_PRESETS[0].lat);
  const [deliveryLng, setDeliveryLng] = useState(SITE_PRESETS[0].lng);

  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const { flash, show, clear } = useFlash();
  const [step, setStep] = useState<1 | 2 | 3>(1);

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

  useEffect(() => {
    fetch(`${API_URL}/fx/eur`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.rate) setEurRate(Number(d.rate));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!machineId) {
      setLoadError(t(locale, "pickMachine"));
      return;
    }
    setLoadError(null);
    fetch(`${API_URL}/machines`)
      .then((r) => r.json())
      .then((data: Machine[]) => {
        const found = (Array.isArray(data) ? data : []).find((m) => m.id === machineId) || null;
        setMachine(found);
        if (!found) setLoadError(t(locale, "pickMachine"));
      })
      .catch(() => setLoadError("Nie udało się pobrać maszyny."));
  }, [machineId, locale]);

  useEffect(() => {
    if (!machine) return;
    const y = calMonth.getFullYear();
    const m = calMonth.getMonth();
    const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const last = new Date(y, m + 1, 0).getDate();
    const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    fetch(`${API_URL}/machines/${machine.id}/availability?from_date=${from}&to_date=${to}`)
        .then((r) => r.json())
        .then((d) => {
        setBusyDates(new Set(Array.isArray(d.busy_dates) ? d.busy_dates : []));
        })
        .catch(() => setBusyDates(new Set()));
  }, [machine, calMonth]);

  useEffect(() => {
    if (!machine) {
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
            machine_id: machine.id,
            start_time: `${startDate}T${startHour}:00`,
            end_time: `${endDate}T${endHour}:00`,
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
  }, [machine, startDate, endDate, startHour, endHour, withOperator, withTransport, address, deliveryLat, deliveryLng]);

  const vendor = useMemo(() => (machine ? resolveMachineVendor(machine) : null), [machine]);
  const money = (n: number) => formatMoney(n, currency, eurRate);

  const estimate = {
    hours: quote?.hours ?? 0,
    days: quote?.days ?? 1,
    machineCost: quote?.machine_cost ?? 0,
    operatorCost: quote?.operator_cost ?? 0,
    transportCost: quote?.transport_cost ?? 0,
    totalNet: quote?.total_net ?? 0,
    totalGross: quote?.total_gross ?? 0,
  };

  const pickDay = (isoDay: string) => {
    if (!startDate || (startDate && endDate && startDate !== endDate) || isoDay < startDate) {
        setStartDate(isoDay);
        setEndDate(isoDay);
        return;
    }
    setEndDate(isoDay);
  };

  const handleBooking = async (e: FormEvent) => {
    e.preventDefault();
    if (step !== 3) return;
    if (!machine) return;
    if (!authUser) {
      setShowLogin(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/bookings`, {
        method: "POST",
        headers: authHeaders(authUser.token),
        body: JSON.stringify({
          machine_id: machine.id,
          start_time: `${startDate}T${startHour}:00`,
          end_time: `${endDate}T${endHour}:00`,
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
            show(formatApiError(data.detail, "Błąd rezerwacji."), "error");
        } else {
            show("Rezerwacja potwierdzona. Umowa PDF też w e-mailu (jeśli skonfigurowano).");
            window.setTimeout(() => router.push("/moje-rezerwacje"), 900);
        }
      } catch {
        show("Błąd sieci przy rezerwacji.", "error");
      } finally {
        setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f5f5f7] font-sans antialiased flex flex-col">
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

      <main className="flex-1 max-w-7xl mx-auto w-full px-5 sm:px-8 py-8 sm:py-12">
        <Link href="/katalog" className="text-sm text-zinc-400 hover:text-white transition">
          ← {t(locale, "backToCatalog")}
        </Link>

        {loadError || !machine || !vendor ? (
          <div className="mt-10 text-center">
            <p className="text-zinc-400">{loadError || t(locale, "pickMachine")}</p>
            <Link
              href="/katalog"
              className="inline-block mt-5 bg-brand text-black font-semibold px-5 py-2.5 rounded-full"
            >
              {t(locale, "browse")}
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* LEWA: produkt */}
            <div className="lg:col-span-5">
            {machine && (
                <div className="rounded-3xl border border-white/[0.08] overflow-hidden bg-[#111113]">
                <div className="relative aspect-[16/11] bg-[#1a1a1c]">
                    <img
                    src={machineImageUrl(machine)}
                    alt={machine.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </div>
                <div className="p-6">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 font-semibold">
                    {t(locale, "bookingTitle")}
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold text-white tracking-tight leading-snug">
                    {machine.name}
                    </h1>
                    <p className="mt-2 text-sm text-zinc-400">
                    {vendor.name} · {vendor.rating}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                    {vendor.district} · {machine.category}
                    </p>
                    <p className="mt-5 text-2xl font-semibold text-white tabular-nums">
                    {money(machine.daily_rate_net)}
                    <span className="text-sm font-normal text-zinc-500">{t(locale, "perDay")}</span>
                    </p>
                </div>
                </div>
            )}
            </div>

            {/* PRAWA: konfigurator */}
            <div className="lg:col-span-7">
              <form
                onSubmit={handleBooking}
                className="rounded-3xl border border-white/[0.09] bg-panel p-6 sm:p-7 space-y-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  {(
                    [
                      [1, "Termin"],
                      [2, "Opcje"],
                      [3, "Potwierdź"],
                    ] as const
                  ).map(([n, label]) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        if (n < step) setStep(n);
                      }}
                      className={`flex-1 text-center rounded-full py-2 text-xs font-medium border transition ${
                        step === n
                          ? "bg-brand text-black border-brand"
                          : step > n
                            ? "bg-white/10 text-white border-white/20"
                            : "bg-transparent text-zinc-500 border-white/10"
                      }`}
                    >
                      {n}. {label}
                    </button>
                  ))}
                </div>

                {step === 1 && (
                <div className="space-y-4">
                
                <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs text-zinc-500">
                        Od dnia
                        <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                            const v = e.target.value;
                            setStartDate(v);
                            if (v > endDate) setEndDate(v);
                        }}
                        className={`${INPUT_CLS} mt-1 rounded-full`}
                        />
                    </label>
                    <label className="block text-xs text-zinc-500">
                        Do dnia
                        <input
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className={`${INPUT_CLS} mt-1 rounded-full`}
                        />
                    </label>
                    </div>

                    <BusyCalendar
                      month={calMonth}
                      busyDates={busyDates}
                      startDate={startDate}
                      endDate={endDate}
                      onPick={pickDay}
                      onPrevMonth={() =>
                        setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))
                      }
                      onNextMonth={() =>
                        setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))
                      }
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-xs text-zinc-500">
                          Od (godzina)
                          <input
                          type="time"
                          value={startHour}
                          onChange={(e) => setStartHour(e.target.value)}
                          className={`${INPUT_CLS} mt-1 rounded-full`}
                          required
                          />
                      </label>
                      <label className="block text-xs text-zinc-500">
                          Do (godzina)
                          <input
                          type="time"
                          value={endHour}
                          onChange={(e) => setEndHour(e.target.value)}
                          className={`${INPUT_CLS} mt-1 rounded-full`}
                          required
                          />
                      </label>
                    </div>

                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          disabled={!startDate || !endDate || endDate < startDate}
                          className="w-full bg-brand text-black font-semibold py-3.5 rounded-full disabled:opacity-50"
                        >
                          Dalej — opcje →
                        </button>
                        </div>
                        )}

                        {step === 2 && (
                        <div className="space-y-4">

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
                  price={`${machine.transport_rate_per_km} zł/km`}
                />

                {withTransport && (
                  <div className="space-y-2.5">
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
                        className={`${INPUT_CLS} rounded-2xl`}
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
                        className={`${INPUT_CLS} rounded-2xl`}
                        required
                      />
                    </label>
                    {machine.base_lat != null && machine.base_lng != null && (
                      <div className="rounded-2xl overflow-hidden border border-white/[0.08]">
                        <iframe
                          title="map"
                          className="w-full h-40 border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(machine.base_lng, deliveryLng) - 0.08}%2C${Math.min(machine.base_lat, deliveryLat) - 0.05}%2C${Math.max(machine.base_lng, deliveryLng) + 0.08}%2C${Math.max(machine.base_lat, deliveryLat) + 0.05}&layer=mapnik&marker=${deliveryLat}%2C${deliveryLng}`}
                        />
                        <p className="px-3 py-2 text-[10px] text-zinc-500 bg-black/30">
                          {t(locale, "mapCaption")}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 border border-white/15 text-zinc-300 py-3 rounded-full text-sm"
                  >
                    ← Wstecz
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="flex-[2] bg-brand text-black font-semibold py-3 rounded-full"
                  >
                    Dalej — podsumowanie →
                  </button>
                </div>
                </div>
                )}

                {step === 3 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-4 space-y-2 text-sm">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Termin</p>
                      <p className="text-zinc-200 tabular-nums">
                        {startDate} {startHour} → {endDate} {endHour}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Opcje</p>
                      <p className="text-zinc-200">
                        {[withOperator && "operator", withTransport && "transport"]
                          .filter(Boolean)
                          .join(" · ") || "tylko maszyna"}
                      </p>
                    </div>
                    {withTransport && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Dostawa</p>
                        <p className="text-zinc-200 truncate" title={address}>
                          {address || "—"}
                        </p>
                      </div>
                    )}
                  </div>

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
                    <span className="text-3xl font-semibold text-white tabular-nums">
                      {money(estimate.totalNet)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>{t(locale, "grossTotal")}</span>
                    <span className="tabular-nums">{money(estimate.totalGross)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>{t(locale, "deposit")}</span>
                    <span className="tabular-nums">{money(machine.deposit_amount)}</span>
                  </div>
                </div>

                {quoteLoading && <p className="text-xs text-zinc-500">{t(locale, "quoting")}</p>}
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
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full border border-white/15 text-zinc-300 py-3 rounded-full text-sm"
                >
                  ← Wstecz do opcji
                </button>

                <button
                  type="submit"
                  disabled={loading || (quote != null && !quote.available)}
                  className="w-full bg-brand hover:bg-brand-soft disabled:opacity-50 text-black font-semibold py-4 rounded-full text-[15px] transition press flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <SpinnerIcon className="w-4 h-4" /> …
                    </>
                  ) : !authUser ? (
                    t(locale, "loginToBook")
                  ) : (
                    t(locale, "bookCta")
                  )}
                </button>
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
                  <FileIcon className="w-3.5 h-3.5" />
                  PDF
                </p>
                </div>
                )}
              </form>
            </div>
          </div>
        )}
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
        onVendorRegister={performVendorRegister}
        onQuickLogin={quickLogin}
      />
    </div>
  );
}

export default function BookingPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090b] text-zinc-400 flex items-center justify-center text-sm">
          Ładowanie rezerwacji…
        </div>
      }
    >
      <BookingPage />
    </Suspense>
  );
}