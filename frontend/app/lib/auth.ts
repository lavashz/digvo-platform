"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "./types";
import { API_URL, AUTH_STORAGE_KEY, formatApiError } from "./api";
import type { RegisterPayload } from "../components/LoginModal";

export function readStoredAuth(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuthUser(readStoredAuth());
    setReady(true);
  }, []);

  const closeLogin = useCallback(() => {
    setShowLogin(false);
    setLoginError(null);
  }, []);

  const clearLoginError = useCallback(() => setLoginError(null), []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthUser(null);
  }, []);

  const performLogin = async (email: string, password: string): Promise<boolean> => {
    setLoginError(null);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(formatApiError(data.detail, "Błąd logowania."));
        return false;
      }
      const userObj: AuthUser = {
        token: data.access_token,
        full_name: data.full_name,
        role: data.role,
        organization_id: data.organization_id ?? null,
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userObj));
      setAuthUser(userObj);
      setShowLogin(false);
      return true;
    } catch {
      setLoginError("Błąd połączenia z serwerem autoryzacji.");
      return false;
    }
  };

  const performRegister = async (payload: RegisterPayload): Promise<boolean> => {
    setLoginError(null);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(formatApiError(data.detail, "Błąd rejestracji."));
        return false;
      }
      const userObj: AuthUser = {
        token: data.access_token,
        full_name: data.full_name,
        role: data.role,
        organization_id: data.organization_id ?? null,
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userObj));
      setAuthUser(userObj);
      setShowLogin(false);
      return true;
    } catch {
      setLoginError("Błąd połączenia z serwerem przy rejestracji.");
      return false;
    }
  };

  const performVendorRegister = async (
    payload: RegisterPayload & { nip: string }
  ): Promise<boolean> => {
    setLoginError(null);
    try {
      const res = await fetch(`${API_URL}/vendors/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(formatApiError(data.detail, "Błąd rejestracji wypożyczalni."));
        return false;
      }
      const userObj: AuthUser = {
        token: data.access_token,
        full_name: data.full_name,
        role: data.role,
        organization_id: data.organization_id ?? null,
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userObj));
      setAuthUser(userObj);
      setShowLogin(false);
      return true;
    } catch {
      setLoginError("Błąd połączenia przy rejestracji wypożyczalni.");
      return false;
    }
  };

  const quickLogin = async (email: string) => performLogin(email, "haslo123");

  return {
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
  };
}