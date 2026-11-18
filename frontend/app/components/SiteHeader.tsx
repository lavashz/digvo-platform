"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthUser } from "../lib/types";
import { t, type Locale, type Currency } from "../lib/i18n";
import { LogoutIcon } from "./Icons";

interface SiteHeaderProps {
  locale: Locale;
  currency: Currency;
  onLocale: (l: Locale) => void;
  onCurrency: (c: Currency) => void;
  authUser: AuthUser | null;
  onLoginClick: () => void;
  onLogout: () => void;
}

const NAV = [
  { href: "/", key: "navHome" as const },
  { href: "/katalog", key: "navCatalog" as const },
  { href: "/moje-rezerwacje", key: "navMyBookings" as const },
];

export default function SiteHeader({
  locale,
  currency,
  onLocale,
  onCurrency,
  authUser,
  onLoginClick,
  onLogout,
}: SiteHeaderProps) {
  const pathname = usePathname();

  const initials = authUser
    ? authUser.full_name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : "";

  return (
    <header className="sticky top-0 z-40 glass border-b border-white/[0.07]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 press" aria-label="Digvo — start">
          <span className="relative w-9 h-9 rounded-xl bg-white text-black font-bold text-lg tracking-tighter flex items-center justify-center overflow-hidden">
            D
            <span className="hazard absolute bottom-0 inset-x-0 h-1.5" />
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-white">Digvo</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Główna nawigacja">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition ${
                  active ? "bg-white text-black" : "text-zinc-400 hover:text-white"
                }`}
              >
                {t(locale, item.key)}
              </Link>
            );
          })}
          {authUser && (authUser.role === "DISPATCHER" || authUser.role === "OPERATOR") && (
            <Link
              href="/panel"
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition ${
                pathname.startsWith("/panel") ? "bg-white text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              {t(locale, "navPanel")}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex bg-black/50 border border-white/[0.08] p-0.5 rounded-full">
            {(["pl", "en"] as Locale[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onLocale(code)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase ${
                  locale === code ? "bg-white text-black" : "text-zinc-400 hover:text-white"
                }`}
              >
                {code}
              </button>
            ))}
          </div>
          <div className="hidden sm:flex bg-black/50 border border-white/[0.08] p-0.5 rounded-full">
            {(["PLN", "EUR"] as Currency[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onCurrency(code)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  currency === code ? "bg-white text-black" : "text-zinc-400 hover:text-white"
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          {authUser ? (
            <div className="flex items-center gap-2">
              <span className="hidden lg:inline text-xs text-zinc-400 max-w-[10rem] truncate">
                {authUser.full_name}
              </span>
              <span className="w-8 h-8 rounded-full bg-brand text-black text-xs font-bold flex items-center justify-center">
                {initials}
              </span>
              <button
                type="button"
                onClick={onLogout}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 flex items-center justify-center"
                aria-label={t(locale, "logout")}
              >
                <LogoutIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLoginClick}
              className="bg-brand hover:bg-brand-soft text-black text-sm font-semibold px-4 py-2 rounded-full transition press"
            >
              {t(locale, "login")}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}