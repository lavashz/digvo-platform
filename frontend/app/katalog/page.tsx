"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LoginModal from "../components/LoginModal";
import SiteHeader from "../components/SiteHeader";
import { SearchIcon } from "../components/Icons";
import { useAuth } from "../lib/auth";
import { API_URL } from "../lib/api";
import { DEMO_ACCOUNTS, VENDORS, resolveMachineVendor } from "../lib/vendors";
import { machineImageUrl } from "../lib/machineImages";
import type { Machine } from "../lib/types";
import { t, formatMoney, type Locale, type Currency } from "../lib/i18n";
import Toast from "../components/Toast";
import { useFlash } from "../lib/flash";

export default function CatalogPage() {
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
    quickLogin,
  } = useAuth();

  const [locale, setLocale] = useState<Locale>("pl");
  const [currency, setCurrency] = useState<Currency>("PLN");
  const [eurRate, setEurRate] = useState(4.25);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorFilter, setVendorFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
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
    fetch(`${API_URL}/fx/eur`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.rate) setEurRate(Number(d.rate));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("category");
    if (cat) setCategoryFilter(cat);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/machines`)
      .then((r) => r.json())
      .then((data) => setMachines(Array.isArray(data) ? data : []))
      .catch(() => setMachines([]))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(machines.map((m) => m.category)));
    return ["ALL", ...unique];
  }, [machines]);

  const filtered = useMemo(() => {
    return machines.filter((m) => {
      if ((m.name || "").toLowerCase().startsWith("test machine")) return false;
      const vendor = resolveMachineVendor(m);
      const matchesVendor = vendorFilter === "ALL" || vendor.id === vendorFilter;
      const matchesCategory =
        categoryFilter === "ALL" ||
        m.category === categoryFilter ||
        (categoryFilter === "Koparki" &&
          m.category.startsWith("Koparki") &&
          !m.category.toLowerCase().includes("ładowar")) ||
        (categoryFilter === "Ładowarki" &&
          (m.category === "Ładowarki" || m.category.startsWith("Ładowarki")));
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        vendor.name.toLowerCase().includes(q);
      return matchesVendor && matchesCategory && matchesSearch;
    });
  }, [machines, vendorFilter, categoryFilter, searchQuery]);

  const money = (amount: number) => formatMoney(amount, currency, eurRate);

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

      <main className="flex-1 relative">
        <div className="absolute inset-0 atmosphere opacity-40 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto w-full px-5 sm:px-8 py-10 sm:py-12">
          <div className="mb-8">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-semibold">
              Digvo
            </p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              {t(locale, "catalog")}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">{t(locale, "fromVendors")}</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 lg:items-center mb-8">
            <div className="relative flex-1 max-w-xl">
              <SearchIcon className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t(locale, "searchPlaceholder")}
                className="w-full bg-panel-2 border border-white/[0.1] focus:border-brand/60 rounded-full pl-11 pr-4 py-3 text-sm text-white outline-none"
              />
            </div>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="bg-panel-2 border border-white/[0.1] rounded-full px-4 py-3 text-sm text-white outline-none"
            >
              <option value="ALL">{t(locale, "allVendors")}</option>
              {Object.values(VENDORS).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.shortName}
                </option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-panel-2 border border-white/[0.1] rounded-full px-4 py-3 text-sm text-white outline-none"
            >
              {Array.from(new Set([...categories, categoryFilter])).map((c) => (
                <option key={c} value={c}>
                  {c === "ALL" ? t(locale, "allCategories") : c}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-zinc-500 mb-5">
            {filtered.length} {t(locale, "resultsOf")}
          </p>

          {loading ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400 text-center sm:text-left">
                Budzimy API na Renderze — pierwsze ładowanie po przerwie może potrwać 20–60 s.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="h-72 rounded-3xl skeleton" />
                ))}
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-zinc-400 py-16 text-center">{t(locale, "noResults")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((m) => {
                const vendor = resolveMachineVendor(m);
                const img = machineImageUrl(m);
                return (
                  <Link
                    key={m.id}
                    href={`/rezerwacja?machine=${m.id}`}
                    className="group block rounded-2xl overflow-hidden bg-[#111113] border border-white/[0.06] hover:border-white/[0.14] transition-colors"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#1a1a1c]">
                      <img
                        src={img}
                        alt={m.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                      <span className="absolute top-3 left-3 text-[11px] font-medium bg-black/55 backdrop-blur-sm text-white px-2.5 py-1 rounded-full">
                        {vendor.shortName}
                      </span>
                      <span className="absolute top-3 right-3 text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 px-2.5 py-1 rounded-full">
                        {t(locale, "available")}
                      </span>
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="text-lg font-semibold text-white tracking-tight drop-shadow">
                          {money(m.daily_rate_net)}
                          <span className="text-xs font-normal text-zinc-300">{t(locale, "perDay")}</span>
                        </p>
                      </div>
                    </div>
                    <div className="p-4">
                      <h2 className="text-[15px] font-semibold text-white leading-snug tracking-tight line-clamp-2">
                        {m.name}
                      </h2>
                      <p className="mt-1.5 text-xs text-zinc-500">
                        {vendor.district} · {m.category}
                      </p>
                      <p className="mt-3 text-xs font-semibold text-brand group-hover:text-brand-soft transition">
                        {t(locale, "reserve")} →
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
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