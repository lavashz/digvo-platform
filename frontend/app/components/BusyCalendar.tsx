"use client";

import { useMemo } from "react";

type Props = {
  month: Date; // dowolny dzień w miesiącu
  busyDates: Set<string>;
  startDate: string;
  endDate: string;
  onPick: (iso: string) => void;
};

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function BusyCalendar({ month, busyDates, startDate, endDate, onPick }: Props) {
  const cells = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(y, m, 1);
    const startPad = (first.getDay() + 6) % 7; // poniedziałek = 0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const out: { iso: string; day: number; inMonth: boolean }[] = [];
    for (let i = 0; i < startPad; i++) out.push({ iso: "", day: 0, inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, m, d);
      out.push({ iso: iso(dt), day: d, inMonth: true });
    }
    return out;
  }, [month]);

  const label = month.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white capitalize">{label}</p>
        <div className="flex gap-3 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500/80" /> zajęty
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-brand" /> wybrany
          </span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-zinc-500 mb-1">
        {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c.inMonth) return <div key={`e-${i}`} className="h-9" />;
          const busy = busyDates.has(c.iso);
          const selected = c.iso === startDate || c.iso === endDate;
          const inRange =
            startDate && endDate && c.iso > startDate && c.iso < endDate;
          return (
            <button
              key={c.iso}
              type="button"
              disabled={busy}
              onClick={() => onPick(c.iso)}
              className={`h-9 rounded-lg text-xs font-medium transition ${
                busy
                  ? "bg-rose-500/20 text-rose-300/80 line-through cursor-not-allowed"
                  : selected
                    ? "bg-brand text-black"
                    : inRange
                      ? "bg-brand/20 text-brand-soft"
                      : "bg-white/[0.04] text-zinc-200 hover:bg-white/[0.1]"
              }`}
            >
              {c.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}