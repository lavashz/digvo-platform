"use client";

import Link from "next/link";
import { t, type Locale } from "../lib/i18n";

export default function SiteFooter({ locale }: { locale: Locale }) {
  return (
    <footer className="border-t border-white/[0.06] mt-auto">
      <div className="hazard h-1 opacity-70" />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
        <div>
          <p className="text-sm text-zinc-300 font-medium">Digvo</p>
          <p className="mt-1">{t(locale, "footerBlurb")}</p>
          <p className="mt-2">
            <a
              href="mailto:kontakt@digvo.pl"
              className="text-zinc-300 hover:text-white transition"
            >
              kontakt@digvo.pl
            </a>
            <span className="text-zinc-600"> · </span>
            <span>{t(locale, "footerCity")}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-5">
          <Link href="/katalog" className="hover:text-white transition">
            {t(locale, "navCatalog")}
          </Link>
          <Link href="/moje-rezerwacje" className="hover:text-white transition">
            {t(locale, "navMyBookings")}
          </Link>
          <Link href="/" className="hover:text-white transition">
            {t(locale, "navHome")}
          </Link>
        </div>
      </div>
      <div className="border-t border-white/[0.06] bg-black">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-zinc-500">
          <p>© 2026 Digvo. {t(locale, "footerRights")}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <span>{t(locale, "footerTagline")}</span>
            <Link href="/regulamin" className="hover:text-zinc-400 transition">
              {t(locale, "footerTerms")}
            </Link>
            <Link href="/polityka-prywatnosci" className="hover:text-zinc-400 transition">
              {t(locale, "footerPrivacy")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}