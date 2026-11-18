"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LoginModal from "../components/LoginModal";
import SiteHeader from "../components/SiteHeader";
import { FileIcon } from "../components/Icons";
import { useAuth } from "../lib/auth";
import { API_URL, authHeaders } from "../lib/api";
import { DEMO_ACCOUNTS, resolveMachineVendor, statusMeta } from "../lib/vendors";
import type { Booking, Machine } from "../lib/types";
import { t, type Locale, type Currency } from "../lib/i18n";

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
    quickLogin,
  } = useAuth();

  const [locale, setLocale] = useState<Locale>("pl");
  const [currency, setCurrency] = useState<Currency>("PLN");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(false);

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
        onLogout={logout}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-5 sm:px-8 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-white">{t(locale, "myBookings")}</h1>
        <p className="mt-2 text-sm text-zinc-400">Umowy PDF i statusy zleceń</p>

        {!ready ? null : !authUser ? (
          <div className="mt-10 rounded-3xl border border-white/[0.08] bg-panel p-10 text-center">
            <p className="text-sm text-zinc-400">Zaloguj się, aby zobaczyć rezerwacje.</p>
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="mt-5 bg-brand text-black font-semibold px-5 py-2.5 rounded-full"
            >
              {t(locale, "login")}
            </button>
          </div>
        ) : loading ? (
          <p className="mt-10 text-sm text-zinc-500">Ładowanie…</p>
        ) : bookings.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-white/[0.08] bg-panel p-10 text-center">
            <p className="text-sm text-zinc-400">Brak rezerwacji na koncie {authUser.full_name}.</p>
            <Link href="/katalog" className="inline-block mt-5 text-brand text-sm font-medium">
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
                  <th className="pb-3 font-medium text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {bookings.map((b) => {
                  const st = statusMeta(b.status);
                  const m = machines.find((x) => x.id === b.machine_id);
                  const v = m ? resolveMachineVendor(m) : null;
                  return (
                    <tr key={b.id} className="hover:bg-white/[0.02]">
                      <td className="py-4 pr-3">
                        <div className="font-medium text-white">{machineName(b.machine_id)}</div>
                        <div className="text-[11px] text-zinc-500">{v?.shortName}</div>
                      </td>
                      <td className="py-4 pr-3 text-xs text-zinc-300">
                        {new Date(b.start_time).toLocaleString("pl-PL", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-4 pr-3 text-xs text-zinc-300">{b.operator_name || "—"}</td>
                      <td className="py-4 pr-3 text-xs text-zinc-300">{b.delivery_address || "Odbiór z bazy"}</td>
                      <td className="py-4 pr-3 font-semibold tabular-nums">{b.total_price_net} zł</td>
                      <td className="py-4 pr-3">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="py-4 text-right">
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
                <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-zinc-600">
                <p>© 2026 Digvo. Wszelkie prawa zastrzeżone.</p>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                    <span>Platforma demo — praca inżynierska</span>
                    <span>Zdjęcia: Wikimedia Commons (CC)</span>
                    <span>Regulamin</span>
                    <span>Polityka prywatności</span>
                </div>
                </div>
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
        onQuickLogin={quickLogin}
      />
    </div>
  );
}