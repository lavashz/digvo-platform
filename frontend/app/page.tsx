"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LoginModal from "./components/LoginModal";
import SiteHeader from "./components/SiteHeader";
import { ArrowRightIcon, HardHatIcon, TruckIcon, FileIcon } from "./components/Icons";
import { useAuth } from "./lib/auth";
import { DEMO_ACCOUNTS } from "./lib/vendors";
import { t, type Locale, type Currency } from "./lib/i18n";
import Toast from "./components/Toast";
import { useFlash } from "./lib/flash";

/** Te same URL-e co w machineImages.ts — u Ciebie już działają w katalogu */
const IMG = {
  excavator: "/machines/cat-excavator.jpg",
  backhoe: "/machines/jcb-backhoe.jpg",
  loader: "/machines/volvo-loader.jpg",
  mini: "/machines/bobcat-mini.jpg",
  liebherr: "/machines/liebherr.jpg",
  tele: "/machines/telehandler.jpg",
};

const CATEGORIES = [
  { label: "Koparki", category: "Koparki", img: IMG.excavator },
  { label: "Koparkoładowarki", category: "Koparkoładowarki", img: IMG.backhoe },
  { label: "Ładowarki", category: "Ładowarki", img: IMG.loader },
  { label: "Minikoparki", category: "Minikoparki", img: IMG.mini },
];

export default function HomePage() {
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

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] antialiased flex flex-col">
      <SiteHeader
        locale={locale}
        currency={currency}
        onLocale={setLocale}
        onCurrency={setCurrency}
        authUser={authUser}
        onLoginClick={() => setShowLogin(true)}
        onLogout={() => {
          logout();
          show(t(locale, "loggedOut"), "info")
        }}
      />


      <main className="flex-1">
        {/* HERO */}
        <section className="relative min-h-[86vh] flex items-end overflow-hidden">
          <img
            src={IMG.excavator}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-[center_35%]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.72)_42%,rgba(0,0,0,0.25)_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-black/50" />
          <div className="absolute bottom-0 inset-x-0 h-2 hazard" />

          <div className="relative w-full max-w-7xl mx-auto px-5 sm:px-8 pb-14 sm:pb-16 pt-28">
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="h-px w-8 bg-brand" />
              <p className="text-brand font-semibold tracking-[0.28em] uppercase text-[11px]">
                Digvo · Bydgoszcz
              </p>
            </div>

            <h1 className="max-w-2xl text-[3rem] sm:text-[4.25rem] font-semibold tracking-[-0.04em] leading-[0.95] text-white">
              {t(locale, "heroTitle1")}
            </h1>

            <p className="mt-6 max-w-md text-[15px] sm:text-base text-zinc-300 leading-relaxed">
              {t(locale, "heroSub")}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/katalog"
                className="inline-flex items-center gap-2 bg-brand hover:bg-brand-soft text-black font-semibold px-7 py-3.5 rounded-full text-[15px] transition"
              >
                {t(locale, "browse")}
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
              <a
                href="#kategorie"
                className="inline-flex items-center px-5 py-3.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-sm text-white transition"
              >
                {t(locale, "seeCategories")}
              </a>
            </div>
          </div>
        </section>

        {/* PASEK ZAUFANIA pod hero */}
        <section className="border-b border-white/[0.06] bg-[#0c0c0e]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              ["3", t(locale, "trustVendors")],
              ["UDT", t(locale, "trustOperators")],
              ["PDF", t(locale, "trustContract")],
              ["24h", t(locale, "trustBooking")],
            ].map(([k, v]) => (
              <div key={v} className="flex items-baseline gap-2">
                <span className="text-brand font-semibold text-lg tabular-nums">{k}</span>
                <span className="text-zinc-400">{v}</span>
              </div>
            ))}
          </div>
        </section>

        {/* KATEGORIE ZE ZDJĘCIAMI */}
        <section id="kategorie" className="max-w-7xl mx-auto px-5 sm:px-8 py-14 sm:py-16">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                {t(locale, "equipmentReady")}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                {t(locale, "equipmentReadySub")}
              </p>
            </div>
            <Link href="/katalog" className="hidden sm:inline text-sm text-brand hover:text-brand-soft font-medium">
              {t(locale, "fullCatalog")}
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.label}
                href={`/katalog?category=${encodeURIComponent(cat.category)}`}
                className="group relative block h-56 sm:h-72 overflow-hidden rounded-2xl bg-[#1a1a1c] ring-1 ring-white/10"
              >
                <img
                  src={cat.img}
                  alt={cat.label}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="text-white font-semibold text-base sm:text-lg tracking-tight">
                    {cat.label}
                  </p>
                  <p className="mt-1 text-[11px] text-brand font-medium opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                    Przeglądaj →
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* dodatkowy rząd — 2 większe kafelki */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {[
              { label: "Koparki kołowe", img: IMG.liebherr, hint: "Liebherr i podobne" },
              { label: "Ładowarki teleskopowe", img: IMG.tele, hint: "Manitou MT i inne" },
            ].map((cat) => (
              <Link
                key={cat.label}
                href="/katalog"
                className="group relative block h-44 sm:h-52 overflow-hidden rounded-2xl bg-[#1a1a1c] ring-1 ring-white/10"
              >
                <img
                  src={cat.img}
                  alt={cat.label}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
                <div className="absolute inset-y-0 left-0 p-5 flex flex-col justify-end">
                  <p className="text-white font-semibold text-xl tracking-tight">{cat.label}</p>
                  <p className="mt-1 text-sm text-zinc-400">{cat.hint}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* JAK TO DZIAŁA */}
        <section className="border-t border-white/[0.06] bg-[#0c0c0e]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
            <div className="flex items-center gap-3 mb-3">
              <span className="h-px w-8 bg-brand" />
              <p className="text-[11px] uppercase tracking-[0.2em] text-brand font-semibold">{t(locale, "processLabel")}</p>
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              {t(locale, "howItWorks")}
            </h2>
            <p className="mt-3 max-w-xl text-sm text-zinc-400 leading-relaxed">
              {t(locale, "processSub")}
            </p>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { n: "01", title: t(locale, "step1"), sub: t(locale, "step1Sub"), icon: <HardHatIcon className="w-5 h-5" /> },
                { n: "02", title: t(locale, "step2"), sub: t(locale, "step2Sub"), icon: <TruckIcon className="w-5 h-5" /> },
                { n: "03", title: t(locale, "step3"), sub: t(locale, "step3Sub"), icon: <FileIcon className="w-5 h-5" /> },
              ].map((step) => (
                <div key={step.n} className="rounded-2xl border border-white/[0.08] bg-[#111113] p-6">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-brand font-mono text-sm tracking-wider">{step.n}</span>
                    <span className="text-brand">{step.icon}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{step.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden border-t border-white/[0.06]">
          <img src={IMG.loader} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/75" />
          <div className="absolute top-0 inset-x-0 h-1.5 hazard opacity-80" />
          <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-20 sm:py-24 text-center">
            <p className="text-brand text-xs font-semibold tracking-[0.22em] uppercase mb-4">Digvo</p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
              {t(locale, "ctaTomorrow")}
            </h2>
            <p className="mt-4 text-zinc-300 max-w-md mx-auto text-sm sm:text-base">
              {t(locale, "ctaTomorrowSub")}
            </p>
            <Link
              href="/katalog"
              className="mt-8 inline-flex items-center gap-2 bg-brand hover:bg-brand-soft text-black font-semibold px-7 py-3.5 rounded-full text-[15px] transition"
            >
              {t(locale, "browse")}
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </section>
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
        {t(locale, "navCatalog")}
      </Link>
      <Link href="/moje-rezerwacje" className="hover:text-white transition">
        {t(locale, "navMyBookings")}
      </Link>
    </div>
  </div>

  <div className="border-t border-white/[0.06] bg-black">
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-zinc-500">
      <p>© 2026 Digvo. Wszelkie prawa zastrzeżone.</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <span>Platforma demo — praca inżynierska</span>
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
        onLogin={async (e, p) => {
          const ok = await performLogin(e, p);
          if (ok) show(t(locale, "loggedIn"), "success")
          return ok;
        }}
        onRegister={async (payload) => {
          const ok = await performRegister(payload);
          if (ok) show(t(locale, "accountCreated"), "success");
          return ok;
        }}
        onVendorRegister={async (payload) => {
          const ok = await performVendorRegister(payload);
          if (ok) show(t(locale, "accountCreated"), "success");
          return ok;
        }}
        onQuickLogin={async (email) => {
          const ok = await quickLogin(email);
          if (ok) show(t(locale, "loggedIn"), "success")
          return ok;
        }}
      />
    </div>
  );
}