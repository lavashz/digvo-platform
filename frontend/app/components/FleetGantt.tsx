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

const ROW_H = 72;
const LABEL_W = 248;
const DAY_MS = 24 * 60 * 60 * 1000;
const SNAP_DAY = DAY_MS;
const SNAP_MIN = 30 * 60 * 1000;

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

function snapTo(ms: number, step: number) {
  return Math.round(ms / step) * step;
}

function toLocalIso(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function toDateInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoDay(d: Date) {
  return toDateInputValue(d);
}

function fmtHm(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusColor(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "bg-brand/90 border-brand text-black";
    case "IN_PROGRESS":
      return "bg-sky-500/90 border-sky-300 text-white";
    case "COMPLETED":
      return "bg-zinc-600/90 border-zinc-400 text-zinc-100";
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

  const today0 = useMemo(() => startOfDay(new Date()), []);
  const snapStep = viewMode === "week" ? SNAP_DAY : SNAP_MIN;

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
  const colCount = viewMode === "week" ? 7 : 24;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTrackW(el.clientWidth));
    ro.observe(el);
    setTrackW(el.clientWidth);
    return () => ro.disconnect();
  }, [viewMode]);

  /** Tydzień: blok zajmuje całe dni. Dzień: precyzja godzinowa. */
  const barGeometry = useCallback(
    (startMs: number, endMs: number) => {
      const s = Math.max(startMs, rangeStart.getTime());
      const e = Math.min(endMs, rangeEnd.getTime());
      if (e <= s) return { left: 0, width: 0 };

      if (viewMode === "week") {
        const startDay = Math.floor(
          (startOfDay(new Date(s)).getTime() - rangeStart.getTime()) / DAY_MS
        );
        const endExclusive =
          startOfDay(new Date(e)).getTime() === e
            ? e
            : addDays(startOfDay(new Date(e)), 1).getTime();
        const endDay = Math.ceil(
          (Math.min(endExclusive, rangeEnd.getTime()) - rangeStart.getTime()) /
            DAY_MS
        );
        const from = Math.max(0, startDay);
        const to = Math.min(7, Math.max(from + 1, endDay));
        const left = (from / 7) * trackW + 3;
        const width = Math.max(28, ((to - from) / 7) * trackW - 6);
        return { left, width };
      }

      const left = ((s - rangeStart.getTime()) / rangeMs) * trackW;
      const right = ((e - rangeStart.getTime()) / rangeMs) * trackW;
      return { left, width: Math.max(16, right - left) };
    },
    [viewMode, rangeStart, rangeEnd, rangeMs, trackW]
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
        start = snapTo(st.origStart + dMs, snapStep);
        end = start + dur;
      } else if (st.kind === "resize-start") {
        start = Math.min(
          snapTo(st.origStart + dMs, snapStep),
          st.origEnd - snapStep
        );
        end = st.origEnd;
      } else {
        end = Math.max(
          snapTo(st.origEnd + dMs, snapStep),
          st.origStart + snapStep
        );
        start = st.origStart;
      }

      let machineId = st.origMachineId;
      if (st.kind === "move") {
        const rowDelta = Math.round(dy / ROW_H);
        const idx = st.machineIds.indexOf(st.origMachineId);
        const next = Math.max(
          0,
          Math.min(st.machineIds.length - 1, idx + rowDelta)
        );
        machineId = st.machineIds[next];
      }

      return { bookingId: st.bookingId, start, end, machineId };
    },
    [trackW, rangeMs, snapStep]
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

  const openDay = (d: Date) => {
    const day = startOfDay(d);
    onAnchorChange(day);
    onViewModeChange("day");
    onDayFilter?.(isoDay(day));
  };

  const dayHeaders = useMemo(() => {
    if (viewMode !== "week") return [];
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(rangeStart, i);
      return {
        d,
        iso: isoDay(d),
        isToday: isoDay(d) === isoDay(today0),
        weekday: d.toLocaleDateString("pl-PL", { weekday: "short" }),
        dayNum: d.toLocaleDateString("pl-PL", { day: "numeric", month: "numeric" }),
      };
    });
  }, [viewMode, rangeStart, today0]);

  const hourHeaders = useMemo(() => {
    if (viewMode !== "day") return [];
    return Array.from({ length: 24 }, (_, h) => ({
      h,
      label: `${String(h).padStart(2, "0")}`,
      work: h >= 6 && h < 18,
    }));
  }, [viewMode]);

  const nowX = useMemo(() => {
    const now = Date.now();
    if (now < rangeStart.getTime() || now > rangeEnd.getTime()) return null;
    if (viewMode === "week") {
      const day = Math.floor(
        (startOfDay(new Date(now)).getTime() - rangeStart.getTime()) / DAY_MS
      );
      const frac = (now - startOfDay(new Date(now)).getTime()) / DAY_MS;
      return ((day + frac) / 7) * trackW;
    }
    return ((now - rangeStart.getTime()) / rangeMs) * trackW;
  }, [viewMode, rangeStart, rangeEnd, rangeMs, trackW]);

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

  const title =
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
      className={`rounded-3xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5 ${
        busy ? "opacity-70 pointer-events-none" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0 max-w-xl">
          <h2 className="text-lg font-semibold text-white tracking-tight">
            Harmonogram floty
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5 capitalize">{title}</p>
          <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
            {viewMode === "week" ? (
              <>
                <span className="text-zinc-300">Wiersz = maszyna</span>
                {" · "}
                <span className="text-zinc-300">kolumna = dzień</span>
                {" · "}
                żółty blok = rezerwacja (godziny na etykiecie). Kliknij dzień albo
                blok → widok godzinowy.
              </>
            ) : (
              <>
                Widok dnia: oś pozioma to godziny 0–24. Przeciągnij blok, żeby
                zmienić czas (co 30 min) albo maszynę.
              </>
            )}
          </p>
          {preview && (
            <p className="text-xs text-brand mt-1.5 font-medium tabular-nums">
              Podgląd: {fmtHm(preview.start)} → {fmtHm(preview.end)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-white/10 p-0.5 bg-black/30">
            {(["week", "day"] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onViewModeChange(m)}
                className={`text-xs px-3.5 py-1.5 rounded-full transition ${
                  viewMode === m
                    ? "bg-white text-black font-semibold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {m === "week" ? "Tydzień" : "Dzień (godziny)"}
              </button>
            ))}
          </div>

          <input
            type="date"
            className="text-xs px-2.5 py-1.5 rounded-full border border-white/10 bg-black/40 text-zinc-200 [color-scheme:dark]"
            value={toDateInputValue(anchor)}
            onChange={(e) => {
              if (!e.target.value) return;
              const d = new Date(`${e.target.value}T12:00:00`);
              onAnchorChange(d);
              if (viewMode === "day") onDayFilter?.(e.target.value);
            }}
          />

          <div className="flex items-center rounded-full border border-white/10 overflow-hidden">
            <button
              type="button"
              className="px-3 py-1.5 text-zinc-300 hover:bg-white/5 text-sm"
              onClick={() =>
                onAnchorChange(addDays(anchor, viewMode === "week" ? -7 : -1))
              }
            >
              ‹
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold text-brand border-x border-white/10 hover:bg-white/5"
              onClick={() => onAnchorChange(new Date())}
            >
              Dziś
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-zinc-300 hover:bg-white/5 text-sm"
              onClick={() =>
                onAnchorChange(addDays(anchor, viewMode === "week" ? 7 : 1))
              }
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto scroll-thin rounded-2xl border border-white/[0.08]">
        <div className={viewMode === "day" ? "min-w-[1200px]" : "min-w-[900px]"}>
          <div className="flex border-b border-white/[0.08] bg-black/50 sticky top-0 z-30">
            <div
              style={{ width: LABEL_W }}
              className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-500 px-3 py-3 border-r border-white/[0.06]"
            >
              Maszyna
            </div>
            <div className="relative flex-1" ref={trackRef}>
              {viewMode === "week" ? (
                <div className="grid grid-cols-7 h-full">
                  {dayHeaders.map((h) => (
                    <button
                      key={h.iso}
                      type="button"
                      onClick={() => openDay(h.d)}
                      className={`py-2 text-center border-r border-white/[0.06] last:border-r-0 transition hover:bg-white/[0.04] ${
                        h.isToday ? "bg-brand/10" : ""
                      }`}
                    >
                      <div
                        className={`text-[10px] uppercase tracking-wide ${
                          h.isToday ? "text-brand" : "text-zinc-500"
                        }`}
                      >
                        {h.weekday}
                      </div>
                      <div
                        className={`text-sm font-semibold tabular-nums ${
                          h.isToday ? "text-brand" : "text-zinc-200"
                        }`}
                      >
                        {h.dayNum}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  className="grid h-full"
                  style={{ gridTemplateColumns: "repeat(24, 1fr)" }}
                >
                  {hourHeaders.map((h) => (
                    <div
                      key={h.h}
                      className={`py-2 text-center border-r border-white/[0.05] last:border-r-0 ${
                        h.work ? "bg-white/[0.02]" : ""
                      }`}
                    >
                      <span className="text-[10px] tabular-nums text-zinc-400">
                        {h.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {machines.length === 0 ? (
            <p className="text-sm text-zinc-500 py-10 text-center">
              Brak maszyn w flocie.
            </p>
          ) : (
            machines.map((m) => (
              <div
                key={m.id}
                className="flex items-stretch border-b border-white/[0.05]"
                style={{ height: ROW_H }}
              >
                <div
                  style={{ width: LABEL_W }}
                  className="shrink-0 px-3 py-2 flex items-center border-r border-white/[0.06] bg-[#0c0c0e]"
                >
                  <p
                    className="text-[12px] leading-snug text-zinc-100 font-medium line-clamp-2"
                    title={m.name}
                  >
                    {m.name}
                  </p>
                </div>

                <div className="relative flex-1 bg-[#0f0f11]">
                  <div
                    className="absolute inset-0 grid pointer-events-none"
                    style={{
                      gridTemplateColumns: `repeat(${colCount}, 1fr)`,
                    }}
                  >
                    {Array.from({ length: colCount }).map((_, i) => {
                      const isTodayCol =
                        viewMode === "week" &&
                        isoDay(addDays(rangeStart, i)) === isoDay(today0);
                      const workHour = viewMode === "day" && i >= 6 && i < 18;
                      return (
                        <div
                          key={i}
                          className={`border-r border-white/[0.05] last:border-r-0 h-full ${
                            isTodayCol
                              ? "bg-brand/[0.07]"
                              : workHour
                                ? "bg-white/[0.015]"
                                : ""
                          }`}
                        />
                      );
                    })}
                  </div>

                  {nowX != null && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-rose-400 z-20 pointer-events-none"
                      style={{ left: nowX }}
                      title="Teraz"
                    />
                  )}

                  {visibleBlocks
                    .filter((bl) => bl.machine_id === m.id)
                    .map((bl) => {
                      const s = new Date(bl.start_time).getTime();
                      const e = new Date(bl.end_time).getTime();
                      const { left, width } = barGeometry(s, e);
                      if (width <= 0) return null;
                      return (
                        <div
                          key={bl.id}
                          title={`Blokada UDT / serwis · ${bl.reason}`}
                          className="absolute top-2 bottom-2 rounded-md bg-rose-500/30 border border-rose-500/50 pointer-events-none z-[1] flex items-center justify-center"
                          style={{ left, width }}
                        >
                          <span className="text-[9px] text-rose-200 font-medium px-1 truncate">
                            Blokada
                          </span>
                        </div>
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
                      const { left, width } = barGeometry(s, e);
                      if (width <= 0) return null;
                      const selected = selectedBookingId === b.id;
                      const label = `${fmtHm(s)}–${fmtHm(e)}`;
                      return (
                        <div
                          key={b.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            onSelectBooking(b.id);
                            if (viewMode === "week") {
                              openDay(new Date(s));
                            }
                          }}
                          onPointerDown={(ev) => startDrag(ev, "move", b)}
                          title={`${b.delivery_address || "Baza"} · ${fmtHm(s)}–${fmtHm(e)} · ${b.total_price_net} zł · ${b.status}`}
                          className={`absolute top-2 bottom-2 rounded-lg border px-2 flex flex-col justify-center cursor-grab active:cursor-grabbing select-none shadow-sm ${statusColor(
                            b.status
                          )} ${selected ? "ring-2 ring-white z-10" : "z-[2]"}`}
                          style={{ left, width }}
                        >
                          {viewMode === "day" && (
                            <span
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize"
                              onPointerDown={(ev) =>
                                startDrag(ev, "resize-start", b)
                              }
                            />
                          )}
                          <span className="pointer-events-none text-[11px] font-bold tabular-nums leading-tight truncate">
                            {label}
                          </span>
                          {width > 90 && (
                            <span className="pointer-events-none text-[9px] opacity-80 truncate leading-tight">
                              {b.delivery_address || "Baza"}
                            </span>
                          )}
                          {viewMode === "day" && (
                            <span
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
                              onPointerDown={(ev) =>
                                startDrag(ev, "resize-end", b)
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-brand/80" /> potwierdzone
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-sky-500/80" /> w trakcie
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-rose-500/40" /> blokada UDT
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-0.5 h-3 bg-rose-400" /> teraz
        </span>
        <span className="text-zinc-600">
          Tydzień = które dni zajęte · Dzień = dokładne godziny i przeciąganie
        </span>
      </div>
    </div>
  );
}