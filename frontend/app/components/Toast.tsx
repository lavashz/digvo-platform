"use client";

import { CheckIcon, XIcon } from "./Icons";
import type { FlashMessage } from "../lib/flash";

export default function Toast({
  flash,
  onClose,
}: {
  flash: FlashMessage | null;
  onClose: () => void;
}) {
  if (!flash) return null;

  const styles =
    flash.type === "success"
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-100"
      : flash.type === "error"
        ? "border-rose-500/30 bg-rose-500/15 text-rose-100"
        : "border-white/15 bg-white/10 text-zinc-100";

  return (
    <div className="fixed bottom-5 left-1/2 z-[60] w-[min(92vw,28rem)] -translate-x-1/2">
      <div
        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-md ${styles}`}
        role="status"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/25">
          {flash.type === "error" ? (
            <XIcon className="h-3.5 w-3.5" />
          ) : (
            <CheckIcon className="h-3.5 w-3.5" />
          )}
        </span>
        <p className="flex-1 text-[13px] leading-snug">{flash.text}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-2 py-1 text-xs opacity-70 hover:opacity-100"
          aria-label="Zamknij"
        >
          ✕
        </button>
      </div>
    </div>
  );
}