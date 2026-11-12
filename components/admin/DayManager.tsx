"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Booking } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { BookingEditDialog } from "./BookingEditDialog";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/apiClient";
import { SERVICE_LABEL, errorMessage } from "@/lib/booking/constants";
import { bangkokToday, formatThaiDate } from "@/lib/booking/dates";
import { formatPhone } from "@/components/booking/BookingSummary";

interface DaySlot {
  start: string;
  end: string;
  publicStatus: string;
  booking: Booking | null;
  closed: boolean;
  closeNote: string | null;
}
interface DayData {
  date: string;
  holiday: { holiday_date: string; note: string | null } | null;
  slots: DaySlot[];
  cancelled: Booking[];
}

/** One day: 9 slots, who booked each, close/open controls. Used by Calendar + Slot Management. */
export function DayManager({ date, onChanged }: { date: string; onChanged?: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [creatingAt, setCreatingAt] = useState<string | null>(null);
  const [closing, setClosing] = useState<DaySlot | null>(null);
  const [closeNote, setCloseNote] = useState("");
  const [warnBooking, setWarnBooking] = useState<{ slot: DaySlot; booking: { booking_code: string; username: string; phone_number: string } } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await api<DayData>(`/api/admin/day?date=${date}`);
    setLoading(false);
    if (!r.ok) return setError(errorMessage(r.code));
    setData(r.data);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    load();
    onChanged?.();
  };

  async function doClose(force: boolean) {
    const slot = closing ?? warnBooking?.slot;
    if (!slot) return;
    setBusy(true);
    const r = await api<{ code: string; booking?: { booking_code: string; username: string; phone_number: string } }>("/api/admin/slots", {
      method: "POST",
      body: { date, start: slot.start, note: closeNote, force },
    });
    setBusy(false);
    if (r.data.code === "HAS_BOOKING" && r.data.booking) {
      setWarnBooking({ slot, booking: r.data.booking });
      setClosing(null);
      return;
    }
    if (!r.ok) return toast.error(errorMessage(r.code));
    toast.success(`ปิดรอบ ${slot.start}–${slot.end} แล้ว`);
    setClosing(null);
    setWarnBooking(null);
    setCloseNote("");
    refresh();
  }

  async function doOpen(slot: DaySlot) {
    setBusy(true);
    const r = await api<{ is_holiday?: boolean }>(`/api/admin/slots?date=${date}&start=${slot.start}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) return toast.error(errorMessage(r.code));
    toast.success(r.data.is_holiday ? `เปิดรอบ ${slot.start} แล้ว (แต่วันนี้ยังเป็นวันหยุด)` : `เปิดรอบ ${slot.start}–${slot.end} แล้ว`);
    refresh();
  }

  if (loading && !data) return <LoadingBlock />;
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return null;

  const isPastDay = date < bangkokToday();
  const activeCount = data.slots.filter((s) => s.booking).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{formatThaiDate(date)}</h2>
          <p className="text-sm text-neutral-500">
            จองแล้ว {activeCount} · ปิด {data.slots.filter((s) => s.closed).length} · ว่าง {data.slots.filter((s) => s.publicStatus === "available").length}
          </p>
        </div>
        <div className="no-print flex gap-2">
          <Link href={`/admin/holidays?date=${date}`} className="min-h-9 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold">
            {data.holiday ? "แก้ไขวันหยุด" : "ตั้งเป็นวันหยุด"}
          </Link>
          <Button size="sm" variant="secondary" onClick={() => window.print()}>พิมพ์</Button>
        </div>
      </div>

      {data.holiday && (
        <div className="mb-4">
          <Alert kind="error">
            <strong>วันหยุดร้าน</strong>{data.holiday.note ? ` — ${data.holiday.note}` : ""} · ลูกค้าไม่สามารถจองวันนี้ได้
            {activeCount > 0 && <span className="mt-1 block font-semibold text-amber-800">⚠ ยังมี {activeCount} การจองในวันนี้ กรุณาติดต่อลูกค้าเพื่อเลื่อนหรือยกเลิก</span>}
          </Alert>
        </div>
      )}

      <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {data.slots.map((s) => (
          <li key={s.start} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
            <div className="w-28 shrink-0 font-semibold tabular-nums">{s.start}–{s.end}</div>
            <div className="min-w-0 flex-1">
              {s.booking ? (
                <button onClick={() => setEditing(s.booking)} className="w-full text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{s.booking.username}</span>
                    <span className="text-sm tabular-nums text-neutral-600">{formatPhone(s.booking.phone_number)}</span>
                    <StatusBadge status={s.booking.booking_status} />
                    {s.closed && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">รอบถูกปิด</span>}
                  </div>
                  <p className="truncate text-sm text-neutral-500">
                    {SERVICE_LABEL[s.booking.service_type]}{s.booking.service_detail ? ` · ${s.booking.service_detail}` : ""} · <span className="font-mono text-xs">{s.booking.booking_code}</span>
                  </p>
                </button>
              ) : s.closed ? (
                <p className="text-sm text-red-600">ปิดรอบ{s.closeNote ? ` — ${s.closeNote}` : ""}</p>
              ) : data.holiday ? (
                <p className="text-sm text-red-500">วันหยุด</p>
              ) : s.publicStatus === "past" ? (
                <p className="text-sm text-neutral-400">หมดเวลาจอง (ว่าง)</p>
              ) : (
                <p className="text-sm text-avail-text">ว่าง</p>
              )}
            </div>
            <div className="no-print flex shrink-0 gap-2">
              {!s.booking && !s.closed && !data.holiday && !isPastDay && (
                <Button size="sm" variant="ghost" onClick={() => setCreatingAt(s.start)}>+ จองแทนลูกค้า</Button>
              )}
              {s.closed ? (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => doOpen(s)}>เปิดรอบ</Button>
              ) : (
                !isPastDay && (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setCloseNote(""); setClosing(s); }}>
                    ปิดรอบ
                  </Button>
                )
              )}
            </div>
          </li>
        ))}
      </ul>

      {data.cancelled.length > 0 && (
        <div className="mt-4">
          <button className="text-sm font-semibold text-neutral-600" onClick={() => setShowCancelled((v) => !v)}>
            {showCancelled ? "▾" : "▸"} รายการที่ยกเลิกแล้ว ({data.cancelled.length})
          </button>
          {showCancelled && (
            <ul className="mt-2 space-y-1 text-sm text-neutral-500">
              {data.cancelled.map((b) => (
                <li key={b.id}>
                  <button className="hover:underline" onClick={() => setEditing(b)}>
                    {b.start_time.slice(0, 5)} · {b.username} · {formatPhone(b.phone_number)} · <span className="font-mono text-xs">{b.booking_code}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* close slot */}
      <Dialog
        open={!!closing}
        onClose={() => setClosing(null)}
        title={`ปิดรอบ ${closing?.start ?? ""}–${closing?.end ?? ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setClosing(null)}>ยกเลิก</Button>
            <Button variant="danger" loading={busy} onClick={() => doClose(false)}>ปิดรอบ</Button>
          </>
        }
      >
        <label className="label" htmlFor="close-note">เหตุผล / หมายเหตุ (ไม่บังคับ)</label>
        <input id="close-note" className="input" maxLength={300} value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="เช่น มีธุระส่วนตัว" />
        <p className="mt-2 text-xs text-neutral-500">ลูกค้าจะไม่สามารถจองรอบนี้ได้ จนกว่าจะเปิดรอบอีกครั้ง</p>
      </Dialog>

      {/* booking exists → warn before closing */}
      <ConfirmDialog
        open={!!warnBooking}
        title="รอบนี้มีลูกค้าจองอยู่แล้ว"
        danger
        loading={busy}
        confirmLabel="ปิดรอบโดยไม่ยกเลิกการจอง"
        message={
          warnBooking && (
            <>
              รอบ {warnBooking.slot.start}–{warnBooking.slot.end} มีการจองของ <strong>{warnBooking.booking.username}</strong> ({formatPhone(warnBooking.booking.phone_number)}) รหัส{" "}
              <span className="font-mono">{warnBooking.booking.booking_code}</span>
              <br />
              <br />
              การปิดรอบจะ <strong>ไม่ยกเลิก</strong> การจองนี้ หากต้องการย้ายหรือยกเลิก กรุณาแก้ไขการจองก่อน
            </>
          )
        }
        onConfirm={() => doClose(true)}
        onClose={() => setWarnBooking(null)}
      />

      <BookingEditDialog open={!!editing} booking={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      <BookingEditDialog
        open={!!creatingAt}
        booking={null}
        preset={creatingAt ? { date, start: creatingAt } : undefined}
        onClose={() => setCreatingAt(null)}
        onSaved={refresh}
      />
    </div>
  );
}
