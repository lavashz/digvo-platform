"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LoginModal from "../components/LoginModal";
import SiteHeader from "../components/SiteHeader";
import { FileIcon } from "../components/Icons";
import { useAuth } from "../lib/auth";
import { DEMO_ACCOUNTS, resolveMachineVendor, statusMeta } from "../lib/vendors";
import type { Booking, Machine } from "../lib/types";
import { t, type Locale, type Currency } from "../lib/i18n";
import Toast from "../components/Toast";
import { useFlash } from "../lib/flash";
import { API_URL, authHeaders, formatApiError } from "../lib/api";

export default function MyBookingsPage() {
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

  const [locale, setLocale] = useState<Locale>("pl");
  const [currency, setCurrency] = useState<Currency>("PLN");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
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

  useEffect(() => {
    fetch(`${API_URL}/machines`)
      .then((r) => r.json())
      .then((d) => setMachines(Array.isArray(d) ? d : []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!authUser) {
      setBookings([]);
      return;
    }
    setLoading(true);
    fetch(`${API_URL}/bookings/my`, { headers: authHeaders(authUser.token) })
      .then((r) => r.json())
      .then((d) => setBookings(Array.isArray(d) ? d : []))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, [authUser]);

  const toLocalIso = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  };

  const reloadMine = () => {
    if (!authUser) return;
    setLoading(true);
    fetch(`${API_URL}/bookings/my`, { headers: authHeaders(authUser.token) })
      .then((r) => r.json())
      .then((d) => setBookings(Array.isArray(d) ? d : []))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  };

  const extendOneDay = async (b: Booking) => {
    if (!authUser) return;
    if (b.status !== "CONFIRMED" && b.status !== "IN_PROGRESS") {
      show("Można przedłużyć tylko aktywne zlecenie.", "error");
      return;
    }
    const start = new Date(b.start_time);
    const end = new Date(b.end_time);
    end.setDate(end.getDate() + 1);
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
      show("Przedłużono o 1 dzień. Cena przeliczona.");
      reloadMine();
    } else {
      show(formatApiError(data.detail, "Nie udało się przedłużyć."), "error");
    }
  };

  const machineName = (id: string) => machines.find((m) => m.id === id)?.name || "Maszyna";

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

      <main className="flex-1 max-w-7xl mx-auto w-full px-5 sm:px-8 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          {t(locale, "myBookings")}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">Umowy PDF i statusy zleceń</p>

        {!ready ? (
          <div className="mt-10 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 rounded-2xl skeleton" />
            ))}
          </div>
        ) : !authUser ? (
          <div className="mt-10 rounded-3xl border border-white/[0.08] bg-[#111113] p-10 sm:p-14 text-center">
            <p className="text-lg font-semibold text-white tracking-tight">Zaloguj się</p>
            <p className="mt-2 text-sm text-zinc-400 max-w-sm mx-auto">
              Po zalogowaniu zobaczysz tu swoje rezerwacje, statusy i umowy PDF.
            </p>
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="mt-6 bg-brand hover:bg-brand-soft text-black font-semibold px-6 py-3 rounded-full"
            >
              {t(locale, "login")}
            </button>
          </div>
        ) : loading ? (
          <div className="mt-10 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-16 rounded-2xl skeleton" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-white/[0.12] bg-[#111113] p-10 sm:p-14 text-center">
            <p className="text-lg font-semibold text-white tracking-tight">Brak rezerwacji</p>
            <p className="mt-2 text-sm text-zinc-400 max-w-sm mx-auto">
              Konto <span className="text-zinc-200">{authUser.full_name}</span> nie ma jeszcze
              żadnych zleceń. Wybierz maszynę z katalogu.
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
                  <th className="pb-3 font-medium">Maszyna</th>
                  <th className="pb-3 font-medium">Termin</th>
                  <th className="pb-3 font-medium">Operator</th>
                  <th className="pb-3 font-medium">Dostawa</th>
                  <th className="pb-3 font-medium">Netto</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {bookings.map((b) => {
                  const st = statusMeta(b.status);
                  const m = machines.find((x) => x.id === b.machine_id);
                  const v = m ? resolveMachineVendor(m) : null;
                  return (
                    <tr key={b.id} className="hover:bg-white/[0.02]">
                      <td className="py-4 pr-3 text-xs text-zinc-300">
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
                      <td className="py-4 pr-3 text-xs text-zinc-300">{b.operator_name || "—"}</td>
                      <td
                        className="py-4 pr-3 text-xs text-zinc-300 max-w-[12rem] truncate"
                        title={b.delivery_address || "Odbiór z bazy"}
                      >
                        {b.delivery_address || "Odbiór z bazy"}
                      </td>
                      <td className="py-4 pr-3 font-semibold tabular-nums">{b.total_price_net} zł</td>
                      <td className="py-4 pr-3">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-4 text-right space-x-1 whitespace-nowrap">
                        {(b.status === "CONFIRMED" || b.status === "IN_PROGRESS") && (
                          <button
                            type="button"
                            onClick={() => extendOneDay(b)}
                            className="inline-flex items-center text-xs border border-brand/40 text-brand hover:bg-brand hover:text-black px-3 py-1.5 rounded-full transition"
                          >
                            +1 dzień
                          </button>
                        )}
                        <a
                          href={`${API_URL}/bookings/${b.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs bg-white/[0.08] hover:bg-white hover:text-black px-3 py-1.5 rounded-full"
                        >
                          <FileIcon className="w-3.5 h-3.5" /> PDF
                        </a>
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