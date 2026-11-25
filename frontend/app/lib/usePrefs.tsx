"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Currency, Locale } from "./i18n";

type PrefsCtx = {
  locale: Locale;
  currency: Currency;
  setLocale: (l: Locale) => void;
  setCurrency: (c: Currency) => void;
};

const PrefsContext = createContext<PrefsCtx | null>(null);

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=31536000;samesite=lax`;
}

export function PrefsProvider({
  children,
  initialLocale = "pl",
  initialCurrency = "PLN",
}: {
  children: ReactNode;
  initialLocale?: Locale;
  initialCurrency?: Currency;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [currency, setCurrencyState] = useState<Currency>(initialCurrency);

  // Tylko gdy cookie nie było — dociągnij z LS raz; przy nawigacji Provider żyje → bez mrugania
  useEffect(() => {
    try {
      const l = localStorage.getItem("digvo_locale");
      const c = localStorage.getItem("digvo_currency");
      if (l === "pl" || l === "en") setLocaleState(l);
      if (c === "PLN" || c === "EUR") setCurrencyState(c);
    } catch {
      /* ignore */
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem("digvo_locale", l);
      writeCookie("digvo_locale", l);
    } catch {
      /* ignore */
    }
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem("digvo_currency", c);
      writeCookie("digvo_currency", c);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ locale, currency, setLocale, setCurrency }),
    [locale, currency, setLocale, setCurrency]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
}