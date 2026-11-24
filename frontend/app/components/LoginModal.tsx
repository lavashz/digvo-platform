"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "../lib/api";
import {
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  ShieldIcon,
  SpinnerIcon,
  XIcon,
} from "./Icons";

export interface DemoAccount {
  label: string;
  email: string;
  role: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  nip?: string;
}

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  accounts: DemoAccount[];
  error: string | null;
  onClearError: () => void;
  onLogin: (email: string, password: string) => Promise<boolean>;
  onRegister: (payload: RegisterPayload) => Promise<boolean>;
  onVendorRegister: (payload: RegisterPayload & { nip: string }) => Promise<boolean>;
  onQuickLogin: (email: string) => Promise<boolean>;
}

const ROLE_TABS = [
  { key: "CLIENT", label: "Klient" },
  { key: "DISPATCHER", label: "Dyspozytor" },
  { key: "OPERATOR", label: "Operator" },
] as const;

function splitLabel(label: string) {
  const idx = label.indexOf(":");
  if (idx === -1) return { kind: "", name: label };
  return { kind: label.slice(0, idx).trim(), name: label.slice(idx + 1).trim() };
}

function initials(name: string) {
  const clean = name.replace(/\(.*?\)/g, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function LoginModal({
  open,
  onClose,
  accounts,
  error,
  onClearError,
  onLogin,
  onRegister,
  onVendorRegister,
  onQuickLogin,

}: LoginModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [nip, setNip] = useState("");
  const [nipHint, setNipHint] = useState<string | null>(null);
  const [nipBusy, setNipBusy] = useState(false);
  const [asVendor, setAsVendor] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [roleTab, setRoleTab] = useState<(typeof ROLE_TABS)[number]["key"]>("CLIENT");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => emailRef.current?.focus(), 60);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setMode("login");
      setPassword("");
      setFullName("");
      setPhone("");
      setNip("");
      setNipHint(null);
      setAsVendor(false);
    }
  }, [open]);

  const visibleAccounts = useMemo(
    () => accounts.filter((a) => a.role === roleTab),
    [accounts, roleTab]
  );

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const ok =
      mode === "login"
        ? await onLogin(email.trim(), password)
        : asVendor
          ? await onVendorRegister({
              email: email.trim(),
              password,
              full_name: fullName.trim(),
              phone: phone.trim(),
              nip: nip.trim(),
            })
          : await onRegister({
              email: email.trim(),
              password,
              full_name: fullName.trim(),
              phone: phone.trim(),
              nip: nip.trim() || undefined,
            });
    setBusy(false);
    if (ok) setPassword("");
  };

  const quick = async (accEmail: string) => {
    if (busy || busyEmail) return;
    setBusyEmail(accEmail);
    await onQuickLogin(accEmail);
    setBusyEmail(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
    >
      <button
        aria-label="Zamknij okno logowania"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in cursor-default"
      />

      <div className="relative w-full sm:max-w-[26rem] max-h-[92vh] overflow-y-auto scroll-thin glass-strong border border-white/[0.1] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl shadow-black/80 animate-pop-in">
        <div className="hazard h-1.5 w-full rounded-t-[2rem]" />

        <button
          onClick={onClose}
          aria-label="Zamknij"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/[0.07] hover:bg-white/[0.14] text-zinc-300 flex items-center justify-center transition press"
        >
          <XIcon className="w-4 h-4" />
        </button>

        <div className="px-7 sm:px-8 pt-8 pb-8">
          <div className="w-12 h-12 rounded-2xl bg-white text-black font-bold text-xl tracking-tighter flex items-center justify-center shadow-lg shadow-brand/10">
            D
          </div>
          <h2 id="login-title" className="mt-5 text-[1.75rem] font-semibold tracking-tight text-white leading-tight">
            {mode === "login"
              ? "Zaloguj się do Digvo"
              : asVendor
                ? "Załóż konto wypożyczalni"
                : "Załóż konto klienta"}
          </h2>
          <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">
            {mode === "login"
              ? "Rezerwuj sprzęt, zarządzaj flotą i pobieraj umowy PDF z jednego konta."
              : asVendor
                ? "Rejestracja dostawcy — NIP wymagany, od razu dostęp do panelu floty."
                : "Rejestracja B2C/B2B — od razu możesz składać rezerwacje i pobierać PDF."}
          </p>

          <div className="mt-5 flex p-1 bg-black/40 border border-white/[0.08] rounded-full">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                onClearError();
              }}
              className={`flex-1 text-xs py-1.5 rounded-full font-medium transition ${
                mode === "login" ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              Logowanie
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                onClearError();
              }}
              className={`flex-1 text-xs py-1.5 rounded-full font-medium transition ${
                mode === "register" ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              Rejestracja
            </button>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3">
            {mode === "register" && (
              <>
                <label className="block">
                  <span className="sr-only">Imię i nazwisko</span>
                  <input
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (error) onClearError();
                    }}
                    placeholder="Imię i nazwisko / nazwa firmy"
                    required
                    className="w-full bg-panel-2 border border-white/[0.1] focus:border-brand/70 rounded-full px-4 py-3.5 text-[15px] text-white placeholder:text-zinc-500 outline-none transition"
                  />
                </label>
                <label className="block">
                  <span className="sr-only">Telefon</span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (error) onClearError();
                    }}
                    placeholder="Telefon (+48 …)"
                    required
                    className="w-full bg-panel-2 border border-white/[0.1] focus:border-brand/70 rounded-full px-4 py-3.5 text-[15px] text-white placeholder:text-zinc-500 outline-none transition"
                  />
                </label>

                <label className="flex items-center gap-2 px-1 py-1 text-[13px] text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={asVendor}
                    onChange={(e) => setAsVendor(e.target.checked)}
                    className="rounded border-white/20"
                  />
                  Rejestruję wypożyczalnię (panel dyspozytora)
                </label>

                <label className="block">
                  <span className="sr-only">NIP firmy</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={nip}
                      onChange={(e) => {
                        setNip(e.target.value);
                        setNipHint(null);
                        if (error) onClearError();
                      }}
                      placeholder={asVendor ? "NIP firmy (wymagany)" : "NIP firmy (opcjonalnie)"}
                      required={asVendor}
                      className="w-full bg-panel-2 border border-white/[0.1] focus:border-brand/70 rounded-full px-4 py-3.5 text-[15px] text-white placeholder:text-zinc-500 outline-none transition"
                    />
                    <button
                      type="button"
                      disabled={nipBusy || nip.replace(/\D/g, "").length < 10}
                      onClick={async () => {
                        setNipBusy(true);
                        setNipHint(null);
                        try {
                          
                          const res = await fetch(
                            `${API_URL}/auth/nip/${encodeURIComponent(nip.trim())}`
                          );
                          const data = await res.json();
                          if (!data.ok) {
                            setNipHint(data.error || "Nie znaleziono NIP.");
                          } else {
                            setNipHint(
                              [data.name, data.status_vat].filter(Boolean).join(" · ")
                            );
                            if (data.name && !fullName.trim()) setFullName(data.name);
                          }
                        } catch {
                          setNipHint("Błąd połączenia z weryfikacją NIP.");
                        }
                        setNipBusy(false);
                      }}
                      className="shrink-0 px-3 rounded-full bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-40 text-xs font-medium text-white"
                    >
                      {nipBusy ? "…" : "Sprawdź"}
                    </button>
                  </div>
                  {nipHint && (
                    <p className="mt-1.5 text-[12px] text-zinc-400 px-1">{nipHint}</p>
                  )}
                </label>
              </>
            )}


            <label className="block">
              <span className="sr-only">Adres e-mail</span>
              <div className="relative">
                <MailIcon className="w-[18px] h-[18px] text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={emailRef}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) onClearError();
                  }}
                  placeholder="E-mail firmowy"
                  required
                  className="w-full bg-panel-2 border border-white/[0.1] focus:border-brand/70 rounded-full pl-11 pr-4 py-3.5 text-[15px] text-white placeholder:text-zinc-500 outline-none transition"
                />
              </div>
            </label>

            <label className="block">
              <span className="sr-only">Hasło</span>
              <div className="relative">
                <LockIcon className="w-[18px] h-[18px] text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) onClearError();
                  }}
                  placeholder={mode === "login" ? "Hasło" : "Hasło (min. 6 znaków)"}
                  required
                  minLength={mode === "register" ? 6 : undefined}
                  className="w-full bg-panel-2 border border-white/[0.1] focus:border-brand/70 rounded-full pl-11 pr-12 py-3.5 text-[15px] text-white placeholder:text-zinc-500 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition"
                >
                  {showPassword ? <EyeOffIcon className="w-[18px] h-[18px]" /> : <EyeIcon className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </label>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/25 text-rose-200 text-[13px] rounded-2xl px-4 py-3 animate-fade-in"
              >
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={
                busy ||
                !email ||
                !password ||
                (mode === "register" && (!fullName || !phone || password.length < 6)) ||
                (mode === "register" && asVendor && nip.replace(/\D/g, "").length < 10)
              }
              className="w-full mt-1 bg-brand hover:bg-brand-soft disabled:opacity-40 disabled:hover:bg-brand text-black font-semibold rounded-full py-3.5 text-[15px] transition press flex items-center justify-center gap-2 shadow-lg shadow-brand/20"
            >
              {busy ? (
                <>
                  <SpinnerIcon className="w-4 h-4" /> {mode === "login" ? "Logowanie…" : "Tworzenie konta…"}
                </>
              ) : mode === "login" ? (
                "Zaloguj się"
              ) : (
                "Zarejestruj i zaloguj"
              )}
            </button>
          </form>

          {mode === "login" && (
            <>
              <div className="flex items-center gap-3 my-6">
                <span className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 font-medium">
                  lub konto demonstracyjne
                </span>
                <span className="h-px flex-1 bg-white/[0.08]" />
              </div>

              <div className="flex p-1 bg-black/40 border border-white/[0.08] rounded-full">
                {ROLE_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setRoleTab(t.key)}
                    className={`flex-1 text-xs py-1.5 rounded-full font-medium transition ${
                      roleTab === t.key ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <ul className="mt-3 space-y-1.5">
                {visibleAccounts.map((acc) => {
                  const { kind, name } = splitLabel(acc.label);
                  const loading = busyEmail === acc.email;
                  return (
                    <li key={acc.email}>
                      <button
                        type="button"
                        onClick={() => quick(acc.email)}
                        disabled={!!busyEmail || busy}
                        className="group w-full flex items-center gap-3 text-left rounded-2xl px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.07] border border-transparent hover:border-white/[0.1] transition press disabled:opacity-60"
                      >
                        <span className="w-10 h-10 rounded-full bg-linear-to-br from-brand-soft to-orange-500 text-black text-[13px] font-bold flex items-center justify-center shrink-0">
                          {initials(name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-white truncate">{name}</span>
                          <span className="block text-[11px] text-zinc-500 truncate">{kind || acc.role}</span>
                        </span>
                        {loading ? (
                          <SpinnerIcon className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronRightIcon className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
            <ShieldIcon className="w-3.5 h-3.5" />
            Środowisko demonstracyjne — dane testowe
          </p>
        </div>
      </div>
    </div>
  );
}