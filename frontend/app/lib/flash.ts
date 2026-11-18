"use client";

import { useCallback, useEffect, useState } from "react";

export type FlashKind = "success" | "error" | "info";

export type FlashMessage = {
  type: FlashKind;
  text: string;
};

export function useFlash(timeoutMs = 5000) {
  const [flash, setFlash] = useState<FlashMessage | null>(null);

  const show = useCallback((text: string, type: FlashKind = "success") => {
    setFlash({ text, type });
  }, []);

  const clear = useCallback(() => setFlash(null), []);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), timeoutMs);
    return () => window.clearTimeout(id);
  }, [flash, timeoutMs]);

  return { flash, show, clear };
}