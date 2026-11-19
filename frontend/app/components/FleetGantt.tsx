"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Booking, Machine, UnavailabilityBlock } from "../lib/types";

type ViewMode = "week" | "day";

type Props = {
  machines: Machine[];
  bookings: Booking[];
  blocks: UnavailabilityBlock[];
  viewMode: ViewMode;
  anchor: Date;
  onAnchorChange: (d: Date) => void;
  onViewModeChange: (m: ViewMode) => void;
  selectedBookingId: string | null;
  onSelectBooking: (id: string | null) => void;
  onSchedule: (args: {
    bookingId: string;
    start_time: string;
    end_time: string;
    machine_id: string;
  }) => Promise<boolean>;
  onDayFilter?: (isoDate: string) => void;
};

const ROW_H = 44;
const LABEL_W = 168;
const SNAP_MS = 30 * 60 * 1000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function snapMs(ms: number) {
  return Math.round(ms / SNAP_MS) * SNAP_MS;
}

function toLocalIso(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function statusColor(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "bg-brand/80 border-brand text-black";
    case "IN_PROGRESS":
      return "bg-sky-500/80 border-sky-300 text-white";
    case "COMPLETED":
      return "bg-zinc-600/80 border-zinc-400 text-zinc-100";
    default:
      return "bg-white/20 border-white/30 text-white";
  }
}

type DragKind = "move" | "resize-start" | "resize-end";

type DragState = {
  kind: DragKind;
  bookingId: string;
  originX: number;
  originY: number;
  origStart: number;
  origEnd: number;
  origMachineId: string;
  machineIds: string[];
};

type Preview = {
  bookingId: string;
  start: number;
  end: number;
  machineId: string;
};

export default function FleetGantt({
  machines,
  bookings,
  blocks,
  viewMode,
  anchor,
  onAnchorChange,
  onViewModeChange,
  selectedBookingId,
  onSelectBooking,
  onSchedule,
  onDayFilter,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(800);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const previewRef = useRef<Preview | null>(null);
  previewRef.current = preview;

  const rangeStart = useMemo(() => {
    const s = startOfDay(anchor);
    if (viewMode === "week") {
      const monOffset = (s.getDay() + 6) % 7;
      return addDays(s, -monOffset);
    }
    return s;
  }, [anchor, viewMode]);

  const rangeEnd = useMemo(
    () => addDays(rangeStart, viewMode === "week" ? 7 : 1),
    [rangeStart, viewMode]
  );

  const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
  const machineIds = useMemo(() => machines.map((m) => m.id), [machines]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTrackW(el.clientWidth));
    ro.observe(el);
    setTrackW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const msToX = useCallback(
    (ms: number) => ((ms - rangeStart.getTime()) / rangeMs) * trackW,
    [rangeStart, rangeMs, trackW]
  );

  const computePreview = useCallback(
    (clientX: number, clientY: number, st: DragState): Preview => {
      const dx = clientX - st.originX;
      const dy = clientY - st.originY;
      const dMs = (dx / Math.max(1, trackW)) * rangeMs;
      const dur = st.origEnd - st.origStart;

      let start = st.origStart;
      let end = st.origEnd;

      if (st.kind === "move") {
        start = snapMs(st.origStart + dMs);
        end = start + dur;
      } else if (st.kind === "resize-start") {
        start = Math.min(snapMs(st.origStart + dMs), st.origEnd - SNAP_MS);
        end = st.origEnd;
      } else {
        end = Math.max(snapMs(st.origEnd + dMs), st.origStart + SNAP_MS);
        start = st.origStart;
      }

      let machineId = st.origMachineId;
      if (st.kind === "move") {
        const rowDelta = Math.round(dy / ROW_H);
        const idx = st.machineIds.indexOf(st.origMachineId);
        const next = Math.max(0, Math.min(st.machineIds.length - 1, idx + rowDelta));
        machineId = st.machineIds[next];
      }

      return { bookingId: st.bookingId, start, end, machineId };
    },
    [trackW, rangeMs]
  );

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      const next = computePreview(e.clientX, e.clientY, drag);
      previewRef.current = next;
      setPreview(next);
    };

    const onUp = async () => {
      const final = previewRef.current;
      const st = drag;
      setDrag(null);
      if (!final) return;

      const changed =
        final.start !== st.origStart ||
        final.end !== st.origEnd ||
        final.machineId !== st.origMachineId;

      if (!changed) {
        setPreview(null);
        return;
      }

      setBusy(true);
      await onSchedule({
        bookingId: final.bookingId,
        start_time: toLocalIso(new Date(final.start)),
        end_time: toLocalIso(new Date(final.end)),
        machine_id: final.machineId,
      });
      setBusy(false);
      setPreview(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, computePreview, onSchedule]);

  const startDrag = (e: React.PointerEvent, kind: DragKind, b: Booking) => {
    if (busy) return;
    if (b.status === "COMPLETED" || b.status === "CANCELLED") return;
    e.preventDefault();
    e.stopPropagation();
    onSelectBooking(b.id);
    const st: DragState = {
      kind,
      bookingId: b.id,
      originX: e.clientX,
      originY: e.clientY,
      origStart: new Date(b.start_time).getTime(),
      origEnd: new Date(b.end_time).getTime(),
      origMachineId: b.machine_id,
      machineIds,
    };
    const init = {
      bookingId: b.id,
      start: st.origStart,
      end: st.origEnd,
      machineId: b.machine_id,
    };
    previewRef.current = init;
    setPreview(init);
    setDrag(st);
  };

  const headerTicks = useMemo(() => {
    const ticks: { label: string; left: number; iso: string }[] = [];
    if (viewMode === "week") {
      for (let i = 0; i < 7; i++) {
        const d = addDays(rangeStart, i);
        const y = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        ticks.push({
          label: d.toLocaleDateString("pl-PL", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
          }),
          left: (i / 7) * 100,
          iso: `${y}-${mo}-${day}`,
        });
      }
    } else {
      for (let h = 0; h < 24; h += 3) {
        ticks.push({
          label: `${String(h).padStart(2, "0")}:00`,
          left: (h / 24) * 100,
          iso: "",
        });
      }
    }
    return ticks;
  }, [viewMode, rangeStart]);

  const visibleBookings = useMemo(
    () =>
      bookings.filter((b) => {
        if (b.status === "CANCELLED") return false;
        const s = new Date(b.start_time).getTime();
        const e = new Date(b.end_time).getTime();
        return s < rangeEnd.getTime() && e > rangeStart.getTime();
      }),
    [bookings, rangeStart, rangeEnd]
  );

  const visibleBlocks = useMemo(
    () =>
      blocks.filter((bl) => {
        const s = new Date(bl.start_time).getTime();
        const e = new Date(bl.end_time).getTime();
        return s < rangeEnd.getTime() && e > rangeStart.getTime();
      }),
    [blocks, rangeStart, rangeEnd]
  );

  const label =
    viewMode === "week"
      ? `${rangeStart.toLocaleDateString("pl-PL", { day: "2-digit", month: "short" })} – ${addDays(rangeStart, 6).toLocaleDateString("pl-PL", { day: "2-digit", month: "short", year: "numeric" })}`
      : rangeStart.toLocaleDateString("pl-PL", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        });

  return (
    <div
      className={`rounded-3xl border border-white/[0.06] bg-[#111113] p-4 sm:p-5 ${
        busy ? "opacity-70 pointer-events-none" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Gantt floty</h2>
          <p className="text-xs text-zinc-500 mt-0.5 capitalize">{label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-white/10 p-0.5">
            {(["week", "day"] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onViewModeChange(m)}
                className={`text-xs px-3 py-1.5 rounded-full ${
                  viewMode === m ? "bg-white text-black" : "text-zinc-400"
                }`}
              >
                {m === "week" ? "Tydzień" : "Dzień"}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-zinc-300"
            onClick={() =>
              onAnchorChange(addDays(anchor, viewMode === "week" ? -7 : -1))
            }
          >
            ←
          </button>
          <button
            type="button"
            className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-zinc-300"
            onClick={() => onAnchorChange(new Date())}
          >
            Dziś
          </button>
          <button
            type="button"
            className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-zinc-300"
            onClick={() =>
              onAnchorChange(addDays(anchor, viewMode === "week" ? 7 : 1))
            }
          >
            →
          </button>
        </div>
      </div>

      <div className="overflow-x-auto scroll-thin">
        <div className="min-w-[640px]">
          <div className="flex border-b border-white/[0.06] pb-2 mb-1">
            <div
              style={{ width: LABEL_W }}
              className="shrink-0 text-[10px] uppercase text-zinc-600 px-2"
            >
              Maszyna
            </div>
            <div className="relative flex-1 h-6" ref={trackRef}>
              {headerTicks.map((t) => (
                <button
                  key={t.label + String(t.left)}
                  type="button"
                  disabled={!t.iso || !onDayFilter}
                  onClick={() => t.iso && onDayFilter?.(t.iso)}
                  className="absolute top-0 text-[10px] text-zinc-500 -translate-x-1/2 hover:text-brand disabled:hover:text-zinc-500"
                  style={{ left: `${t.left}%` }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {machines.length === 0 ? (
            <p className="text-sm text-zinc-500 py-8 text-center">
              Brak maszyn w flocie.
            </p>
          ) : (
            machines.map((m) => (
              <div
                key={m.id}
                className="flex items-stretch border-b border-white/[0.04]"
                style={{ height: ROW_H }}
              >
                <div
                  style={{ width: LABEL_W }}
                  className="shrink-0 px-2 flex items-center text-xs text-zinc-300 truncate"
                  title={m.name}
                >
                  {m.name}
                </div>
                <div className="relative flex-1 bg-white/[0.015]">
                  {(viewMode === "week" ? 7 : 8) > 0 &&
                    Array.from({ length: viewMode === "week" ? 7 : 8 }).map(
                      (_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-l border-white/[0.04]"
                          style={{
                            left: `${(i / (viewMode === "week" ? 7 : 8)) * 100}%`,
                          }}
                        />
                      )
                    )}

                  {visibleBlocks
                    .filter((bl) => bl.machine_id === m.id)
                    .map((bl) => {
                      const s = Math.max(
                        new Date(bl.start_time).getTime(),
                        rangeStart.getTime()
                      );
                      const e = Math.min(
                        new Date(bl.end_time).getTime(),
                        rangeEnd.getTime()
                      );
                      const left = msToX(s);
                      const width = Math.max(4, msToX(e) - left);
                      return (
                        <div
                          key={bl.id}
                          title={`Blokada ${bl.reason}`}
                          className="absolute top-2 bottom-2 rounded-md bg-rose-500/25 border border-rose-500/40 pointer-events-none"
                          style={{ left, width }}
                        />
                      );
                    })}

                  {visibleBookings
                    .filter((b) => {
                      const mid =
                        preview?.bookingId === b.id
                          ? preview.machineId
                          : b.machine_id;
                      return mid === m.id;
                    })
                    .map((b) => {
                      const isPrev = preview?.bookingId === b.id;
                      const s = isPrev
                        ? preview!.start
                        : new Date(b.start_time).getTime();
                      const e = isPrev
                        ? preview!.end
                        : new Date(b.end_time).getTime();
                      const left = msToX(Math.max(s, rangeStart.getTime()));
                      const right = msToX(Math.min(e, rangeEnd.getTime()));
                      const width = Math.max(8, right - left);
                      const selected = selectedBookingId === b.id;
                      return (
                        <div
                          key={b.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectBooking(b.id)}
                          onPointerDown={(ev) => startDrag(ev, "move", b)}
                          title={`${b.delivery_address || "Baza"} · ${b.total_price_net} zł · ${b.status}`}
                          className={`absolute top-1.5 bottom-1.5 rounded-lg border px-1.5 flex items-center cursor-grab active:cursor-grabbing text-[10px] font-semibold truncate select-none ${statusColor(
                            b.status
                          )} ${selected ? "ring-2 ring-white/70 z-10" : "z-[1]"}`}
                          style={{ left, width }}
                        >
                          <span
                            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize"
                            onPointerDown={(ev) =>
                              startDrag(ev, "resize-start", b)
                            }
                          />
                          <span className="truncate pointer-events-none pl-1">
                            {new Date(s).toLocaleDateString("pl-PL", {
                              day: "2-digit",
                              month: "2-digit",
                            })}
                          </span>
                          <span
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize"
                            onPointerDown={(ev) =>
                              startDrag(ev, "resize-end", b)
                            }
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-brand/80" /> CONFIRMED
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-sky-500/80" /> IN_PROGRESS
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-rose-500/40" /> blokada UDT
        </span>
        <span>Przeciągnij = czas/maszyna · krawędzie = długość · snap 30 min</span>
      </div>
    </div>
  );
}