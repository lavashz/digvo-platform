"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import LoginModal from "../components/LoginModal";
import SiteHeader from "../components/SiteHeader";
import { FileIcon } from "../components/Icons";
import { useAuth } from "../lib/auth";
import { DEMO_ACCOUNTS, resolveMachineVendor, statusMeta, paymentMeta } from "../lib/vendors";
import type { Booking, Machine } from "../lib/types";
import { t, formatMoney, type Locale, type Currency } from "../lib/i18n";
import { usePrefs } from "../lib/usePrefs";
import Toast from "../components/Toast";
import { useFlash } from "../lib/flash";
import { API_URL, authHeaders, formatApiError } from "../lib/api";
import { machineImageUrl } from "../lib/machineImages";
import SoftSelect from "../components/SoftSelect";


function MyBookingsPage() {
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
  const [eurRate, setEurRate] = useState(4.25);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(false);
  const { flash, show, clear } = useFlash();
  const [extendDays, setExtendDays] = useState<Record<string, string>>({});
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showNextSteps, setShowNextSteps] = useState(false);
  const [loadError, setLoadError] = useState(false);

useEffect(() => {
  if (searchParams.get("fresh") === "1") setShowNextSteps(true);
}, [searchParams]);

const dismissNextSteps = () => {
  setShowNextSteps(false);
  router.replace("/moje-rezerwacje");
};

  useEffect(() => {
    fetch(`${API_URL}/machines`)
      .then((r) => r.json())
      .then((d) => setMachines(Array.isArray(d) ? d : []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!authUser) {
      setBookings([]);
      setLoadError(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    fetch(`${API_URL}/bookings/my`, { headers: authHeaders(authUser.token) })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => setBookings(Array.isArray(d) ? d : []))
      .catch(() => {
        setBookings([]);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [authUser]);

  useEffect(() => {
    fetch(`${API_URL}/fx/eur`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.rate) setEurRate(Number(d.rate));
      })
      .catch(() => undefined);
  }, []);

  const toLocalIso = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  };

  const reloadMine = () => {
    if (!authUser) return;
    setLoading(true);
    setLoadError(false);
    fetch(`${API_URL}/bookings/my`, { headers: authHeaders(authUser.token) })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => setBookings(Array.isArray(d) ? d : []))
      .catch(() => {
        setBookings([]);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  };

  const extendByDays = async (b: Booking) => {
    if (!authUser) return;
    if (b.status !== "CONFIRMED" && b.status !== "IN_PROGRESS") {
      show(t(locale, "extendOnlyActive"), "error");
      return;
    }
    const days = Math.min(7, Math.max(1, Number(extendDays[b.id] || "1")));
    const start = new Date(b.start_time);
    const end = new Date(b.end_time);
    end.setDate(end.getDate() + days);
    const res = await fetch(`${API_URL}/bookings/${b.id}/schedule`, {
      method: "PATCH",
      headers: authHeaders(authUser.token),
      body: JSON.stringify({
        start_time: toLocalIso(start),
        end_time: toLocalIso(end),
        machine_id: b.machine_id,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      show(t(locale, "extendOk"));
      reloadMine();
    } else {
      show(formatApiError(data.detail, t(locale, "extendFail")), "error");
    }
  };

  const reportTransfer = async (bookingId: string) => {
    if (!authUser) return;
    const res = await fetch(`${API_URL}/bookings/${bookingId}/payment`, {
      method: "PATCH",
      headers: authHeaders(authUser.token),
      body: JSON.stringify({ payment_status: "TRANSFER_REPORTED" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      show(formatApiError(data.detail, "Nie udało się zgłosić przelewu."), "error");
      return;
    }
    show("Zgłoszono przelew kaucji.", "success");
    reloadMine();
  };

  const machineName = (b: Booking) =>
    b.machine_name || machines.find((m) => m.id === b.machine_id)?.name || "Maszyna";

  const money = (n: number) => formatMoney(n, currency, eurRate);

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
          show(t(locale, "loggedOut"), "info");
        }}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-5 sm:px-8 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          {t(locale, "myBookings")}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">{t(locale, "myBookingsSub")}</p>

        {authUser && showNextSteps && (
          <div className="mt-6 rounded-3xl border border-brand/30 bg-brand/[0.06] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white tracking-tight">
                  {t(locale, "nextStepsTitle")}
                </p>
                <p className="mt-1 text-xs text-zinc-400">{t(locale, "nextStepsSub")}</p>
              </div>
              <button
                type="button"
                onClick={dismissNextSteps}
                className="text-xs font-medium text-zinc-400 hover:text-white transition"
              >
                {t(locale, "nextStepsDismiss")}
              </button>
            </div>
            <ol className="mt-4 space-y-2 text-sm text-zinc-300 list-decimal list-inside">
              <li>{t(locale, "nextStep1")}</li>
              <li>{t(locale, "nextStep2")}</li>
              <li>{t(locale, "nextStep3")}</li>
            </ol>
          </div>
        )}

        {!ready ? (
          <div className="mt-10 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 rounded-2xl skeleton" />
            ))}
          </div>
        ) : !authUser ? (
          <div className="mt-10 rounded-3xl border border-white/[0.08] bg-[#111113] p-10 sm:p-14 text-center">
            <p className="text-lg font-semibold text-white tracking-tight">{t(locale, "loginTitle")}</p>
            <p className="mt-2 text-sm text-zinc-400 max-w-sm mx-auto">
              {t(locale, "loginBookingsHint")}
            </p>
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="mt-6 bg-brand hover:bg-brand-soft text-black font-semibold px-6 py-3 rounded-full"
            >
              {t(locale, "login")}
            </button>
          </div>
        ) : loadError ? (
          <div className="mt-10 rounded-3xl border border-white/[0.08] bg-[#111113] p-10 text-center space-y-4">
            <p className="text-sm text-zinc-400 max-w-md mx-auto">{t(locale, "apiLoadFail")}</p>
            <button
              type="button"
              onClick={reloadMine}
              className="inline-flex bg-brand hover:bg-brand-soft text-black font-semibold px-5 py-2.5 rounded-full text-sm"
            >
              {t(locale, "apiRetry")}
            </button>
          </div>
        ) : bookings.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-white/[0.12] bg-[#111113] p-10 sm:p-14 text-center">
            <p className="text-lg font-semibold text-white tracking-tight">{t(locale, "noBookings")}</p>
            <p className="mt-2 text-sm text-zinc-400 max-w-sm mx-auto">
              <span className="text-zinc-200">{authUser.full_name}</span>{" "}
              {t(locale, "noBookingsHint")}
            </p>
            <Link
              href="/katalog"
              className="inline-flex mt-6 bg-brand hover:bg-brand-soft text-black font-semibold px-6 py-3 rounded-full text-sm"
            >
              {t(locale, "browse")} →
            </Link>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto scroll-thin">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-white/[0.08] text-zinc-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="pb-3 pl-3 font-medium">{t(locale, "colMachine")}</th>
                  <th className="pb-3 font-medium">{t(locale, "colTerm")}</th>
                  <th className="pb-3 font-medium">{t(locale, "colOperator")}</th>
                  <th className="pb-3 font-medium">{t(locale, "colDelivery")}</th>
                  <th className="pb-3 font-medium">{t(locale, "colNet")}</th>
                  <th className="pb-3 pr-4 font-medium">{t(locale, "colStatus")}</th>
                  <th className="pb-3 pl-4 pr-3 font-medium text-right">{t(locale, "colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {bookings.map((b) => {
                  const st = statusMeta(b.status, locale);
                  const m = machines.find((x) => x.id === b.machine_id);
                  return (
                    <tr key={b.id} className="hover:bg-white/[0.02]">
                      <td className="py-4 pl-3 pr-3 align-middle">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#1a1a1c] shrink-0 border border-white/[0.06]">
                            <img
                              src={
                                b.image_url ||
                                (m ? machineImageUrl(m) : machineImageUrl({
                                  name: b.machine_name || "",
                                  category: b.machine_category || "",
                                  image_url: b.image_url,
                                }))
                              }
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{machineName(b)}</p>
                            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                              {b.organization_name ||
                                (m ? resolveMachineVendor(m).shortName : null) ||
                                "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-3 align-middle text-xs text-zinc-300">
                        <div>
                          {new Date(b.start_time).toLocaleString("pl-PL", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div className="text-zinc-500">
                          →{" "}
                          {new Date(b.end_time).toLocaleString("pl-PL", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="py-4 pr-3 align-middle text-xs text-zinc-300">
                        {b.operator_name || "—"}
                      </td>
                      <td
                        className="py-4 pr-3 align-middle text-xs text-zinc-300 max-w-[12rem] truncate"
                          title={b.delivery_address || t(locale, "pickupAtBase")}
>
                          {b.delivery_address || t(locale, "pickupAtBase")}
                      </td>
                      <td className="py-4 pr-3 align-middle font-semibold tabular-nums">
                        {money(b.total_price_net)}
                      </td>
                      <td className="py-4 pr-6 align-middle">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] ${st.cls}`}>
                            {st.label}
                          </span>
                          <span className={`inline-flex w-fit px-2.5 py-1 rounded-full text-[11px] ${paymentMeta(b.payment_status, locale).cls}`}>
                            {paymentMeta(b.payment_status, locale).label}
                          </span>
                          {(b.deposit_required ?? 0) > 0 && (
                            <p className="text-[11px] text-zinc-500 max-w-[11rem] leading-snug">
                              {t(locale, "depositAmount")}:{" "}
                              <span className="tabular-nums text-zinc-300">
                                {money(b.deposit_required || 0)}
                              </span>
                              <br />
                              {b.payment_status === "DEPOSIT_CONFIRMED"
                                ? t(locale, "depositHintConfirmed")
                                : b.payment_status === "TRANSFER_REPORTED"
                                  ? t(locale, "depositHintReported")
                                  : t(locale, "depositHintAwaiting")}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 pl-4 pr-3 align-middle text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          {(!b.payment_status || b.payment_status === "AWAITING_TRANSFER") &&
                            b.status !== "CANCELLED" && (
                            <button
                              type="button"
                              onClick={() => reportTransfer(b.id)}
                              className="inline-flex items-center text-xs font-medium border border-white/20 text-zinc-200 hover:bg-white hover:text-black px-3 py-1.5 rounded-full transition"
                            >
                              {t(locale, "reportTransfer")}
                            </button>
                          )}
                          <div className="inline-flex flex-wrap justify-end items-center gap-1.5">
                            {(b.status === "CONFIRMED" || b.status === "IN_PROGRESS") && (
                              <>
                                <div className="w-[6.75rem] shrink-0">
                                  <SoftSelect
                                    size="sm"
                                    value={extendDays[b.id] || "1"}
                                    onChange={(v) =>
                                      setExtendDays((prev) => ({ ...prev, [b.id]: v }))
                                    }
                                    options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({
                                      value: String(n),
                                      label:
                                        n === 1
                                          ? t(locale, "day1")
                                          : t(locale, "dayN").replace("{n}", String(n)),
                                    }))}
                                    ariaLabel={t(locale, "extendByDays")}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => extendByDays(b)}
                                  className="inline-flex items-center text-xs font-medium border border-brand/40 text-brand hover:bg-brand hover:text-black px-3 py-1.5 rounded-full transition"
                                >
                                  {t(locale, "extendOneDay")}
                                </button>
                              </>
                            )}
                            <a
                              href={`${API_URL}/bookings/${b.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium bg-white/[0.08] hover:bg-white hover:text-black border border-white/[0.12] px-3 py-1.5 rounded-full transition"
                            >
                              <FileIcon className="w-3.5 h-3.5" /> PDF
                            </a>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

export default function MyBookingsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090b] text-zinc-400 flex items-center justify-center text-sm">
          Ładowanie…
        </div>
      }
    >
      <MyBookingsPage />
    </Suspense>
  );
}