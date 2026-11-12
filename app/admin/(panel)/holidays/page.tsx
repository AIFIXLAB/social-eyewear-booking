"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Holiday } from "@/types";
import { PageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Alert, EmptyState } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/apiClient";
import { errorMessage } from "@/lib/booking/constants";
import { bangkokToday, formatThaiDate, hm, isYmd } from "@/lib/booking/dates";
import { formatPhone } from "@/components/booking/BookingSummary";

interface Conflict { id: string; booking_code: string; booking_date: string; start_time: string; username: string; phone_number: string }

function Holidays() {
  const sp = useSearchParams();
  const toast = useToast();
  const [date, setDate] = useState(isYmd(sp.get("date")) ? (sp.get("date") as string) : "");
  const [note, setNote] = useState("");
  const [scope, setScope] = useState<"upcoming" | "all">("upcoming");
  const [list, setList] = useState<Holiday[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastConflicts, setLastConflicts] = useState<Conflict[] | null>(null);
  const [deleting, setDeleting] = useState<Holiday | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<{ holidays: Holiday[]; conflicts: Conflict[] }>(`/api/admin/holidays?scope=${scope}`);
    setLoading(false);
    if (!r.ok) return toast.error(errorMessage(r.code));
    setList(r.data.holidays);
    setConflicts(r.data.conflicts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  // prefill note if editing an existing holiday
  useEffect(() => {
    const h = list.find((x) => x.holiday_date === date);
    if (h) setNote(h.note ?? "");
  }, [date, list]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!isYmd(date)) return toast.error("กรุณาเลือกวันที่");
    setSaving(true);
    const r = await api<{ conflicting_bookings: Conflict[] }>("/api/admin/holidays", { method: "POST", body: { date, note } });
    setSaving(false);
    if (!r.ok) return toast.error(errorMessage(r.code));
    const c = (r.data.conflicting_bookings ?? []).map((x) => ({ ...x, booking_date: date }));
    setLastConflicts(c.length ? c : null);
    toast.success(c.length ? `บันทึกวันหยุดแล้ว — มี ${c.length} การจองในวันนั้นที่ต้องจัดการ` : "บันทึกวันหยุดแล้ว");
    setDate("");
    setNote("");
    load();
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    const r = await api(`/api/admin/holidays?date=${deleting.holiday_date}`, { method: "DELETE" });
    setSaving(false);
    if (!r.ok) return toast.error(errorMessage(r.code));
    toast.success("ยกเลิกวันหยุดแล้ว เปิดรับจองตามปกติ");
    setDeleting(null);
    load();
  }

  const conflictsByDate = conflicts.reduce<Record<string, Conflict[]>>((m, c) => ((m[c.booking_date] ??= []).push(c), m), {});
  const isEdit = list.some((h) => h.holiday_date === date);

  return (
    <div>
      <PageHeader title="Holiday Management" subtitle="กำหนดวันหยุดร้าน — ลูกค้าจะจองวันนั้นไม่ได้ทั้ง 9 รอบ" />

      <form onSubmit={save} className="card mb-6 grid gap-3 p-4 sm:grid-cols-[200px_1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="hd">วันที่</label>
          <input id="hd" type="date" min={bangkokToday()} className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="hn">หมายเหตุ (แสดงให้ลูกค้าเห็น)</label>
          <input id="hn" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น หยุดประจำเดือน" />
        </div>
        <Button type="submit" size="lg" loading={saving}>{isEdit ? "บันทึกการแก้ไข" : "กำหนดวันหยุด"}</Button>
      </form>

      {lastConflicts && (
        <div className="mb-6">
          <Alert kind="warning">
            <p className="font-semibold">วันหยุดที่เพิ่งตั้งมีลูกค้าจองไว้แล้ว {lastConflicts.length} ราย — ระบบไม่ได้ยกเลิกให้อัตโนมัติ</p>
            <ul className="mt-2 list-disc pl-5">
              {lastConflicts.map((c) => (
                <li key={c.id}>{hm(c.start_time)} · {c.username} · {formatPhone(c.phone_number)} · <span className="font-mono">{c.booking_code}</span></li>
              ))}
            </ul>
            <p className="mt-2">กรุณาติดต่อลูกค้าแล้วเลื่อนหรือยกเลิกที่หน้า <Link className="font-semibold underline" href="/admin/bookings">รายการจอง</Link></p>
          </Alert>
        </div>
      )}

      <div className="mb-3 flex gap-2">
        {(["upcoming", "all"] as const).map((s) => (
          <button key={s} onClick={() => setScope(s)} className={`rounded-full px-3.5 py-2 text-sm ${scope === s ? "bg-brand-700 text-white" : "bg-neutral-100"}`}>
            {s === "upcoming" ? "วันหยุดที่กำลังจะถึง" : "ทั้งหมด"}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : list.length === 0 ? (
        <EmptyState title="ยังไม่มีวันหยุด" description="ทุกวันเปิดรับจอง 9 รอบตามปกติ" />
      ) : (
        <ul className="space-y-2">
          {list.map((h) => {
            const c = conflictsByDate[h.holiday_date] ?? [];
            return (
              <li key={h.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-red-700">{formatThaiDate(h.holiday_date)}</p>
                    <p className="text-sm text-neutral-600">{h.note || "—"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => { setDate(h.holiday_date); setNote(h.note ?? ""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>แก้ไข</Button>
                    <Button size="sm" variant="secondary" onClick={() => setDeleting(h)}>ยกเลิกวันหยุด</Button>
                  </div>
                </div>
                {c.length > 0 && (
                  <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    ⚠ มี {c.length} การจองที่ยังไม่ได้จัดการ:{" "}
                    {c.map((x) => `${hm(x.start_time)} ${x.username}`).join(", ")}{" "}
                    <Link href={`/admin/calendar?date=${h.holiday_date}`} className="font-semibold underline">จัดการ</Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="ยกเลิกวันหยุด"
        loading={saving}
        confirmLabel="ยกเลิกวันหยุด"
        message={deleting && <>ยกเลิกวันหยุด {formatThaiDate(deleting.holiday_date)}? ลูกค้าจะกลับมาจองวันนี้ได้ (ยกเว้นรอบที่ปิดไว้)</>}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

export default function HolidaysPage() {
  return (
    <Suspense>
      <Holidays />
    </Suspense>
  );
}
