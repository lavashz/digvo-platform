"use client";

import { PrefsProvider } from "../lib/usePrefs";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return <PrefsProvider>{children}</PrefsProvider>;
}