"use client";
import { useEffect, useState } from "react";
import type { Booking, BookingStatus, ServiceType } from "@/types";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/apiClient";
import { SERVICE_TYPES, SLOT_STARTS, STATUS_LABEL, errorMessage, slotEnd } from "@/lib/booking/constants";
import { formatThaiDateTime, hm } from "@/lib/booking/dates";
import { validateCustomerFields, type FieldErrors } from "@/lib/validation/booking";

interface DaySlot { start: string; booking: Booking | null; closed: boolean; publicStatus: string }

/**
 * Create / view / edit / move / cancel a booking.
 * mode "edit" needs `booking`; mode "create" can take a preset date/start.
 */
export function BookingEditDialog({
  open,
  booking,
  preset,
  onClose,
  onSaved,
}: {
  open: boolean;
  booking: Booking | null;
  preset?: { date: string; start: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isCreate = !booking;
  const [f, setF] = useState({
    date: "", start: "", username: "", phone: "", serviceType: "eye_exam" as ServiceType,
    serviceDetail: "", status: "confirmed" as BookingStatus, adminNote: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [daySlots, setDaySlots] = useState<DaySlot[] | null>(null);
  const [holiday, setHoliday] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setServerError(null);
    if (booking) {
      setF({
        date: booking.booking_date, start: hm(booking.start_time), username: booking.username, phone: booking.phone_number,
        serviceType: booking.service_type, serviceDetail: booking.service_detail ?? "", status: booking.booking_status,
        adminNote: booking.admin_note ?? "",
      });
    } else {
      setF({ date: preset?.date ?? "", start: preset?.start ?? "", username: "", phone: "", serviceType: "eye_exam", serviceDetail: "", status: "confirmed", adminNote: "" });
    }
  }, [open, booking, preset]);

  // load the target day so we can show which slots are free
  useEffect(() => {
    if (!open || !/^\d{4}-\d{2}-\d{2}$/.test(f.date)) {
      setDaySlots(null);
      return;
    }
    let cancelled = false;
    api<{ slots: DaySlot[]; holiday: { note: string | null } | null }>(`/api/admin/day?date=${f.date}`).then((r) => {
      if (cancelled || !r.ok) return;
      setDaySlots(r.data.slots);
      setHoliday(r.data.holiday ? r.data.holiday.note || "วันหยุดร้าน" : null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, f.date]);

  function slotLabel(start: string): { label: string; disabled: boolean } {
    const s = daySlots?.find((x) => x.start === start);
    const mine = s?.booking && booking && s.booking.id === booking.id;
    if (!s) return { label: `${start}–${slotEnd(start)}`, disabled: false };
    if (s.booking && !mine) return { label: `${start}–${slotEnd(start)} (จองแล้ว: ${s.booking.username})`, disabled: true };
    if (s.closed && !mine) return { label: `${start}–${slotEnd(start)} (ปิดรอบ)`, disabled: true };
    return { label: `${start}–${slotEnd(start)}${mine ? " (รอบปัจจุบัน)" : " (ว่าง)"}`, disabled: false };
  }

  async function save(statusOverride?: BookingStatus) {
    const status = statusOverride ?? f.status;
    const errs = validateCustomerFields(f);
    if (!f.date) errs.date = "กรุณาเลือกวันที่";
    if (!f.start) errs.startTime = "กรุณาเลือกเวลา";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setServerError(null);
    const r = isCreate
      ? await api("/api/admin/bookings", {
          method: "POST",
          body: { date: f.date, startTime: f.start, username: f.username, phone: f.phone, serviceType: f.serviceType, serviceDetail: f.serviceDetail, idempotencyKey: crypto.randomUUID() },
        })
      : await api(`/api/admin/bookings/${booking!.id}`, {
          method: "PATCH",
          body: { date: f.date, startTime: f.start, username: f.username, phone: f.phone, serviceType: f.serviceType, serviceDetail: f.serviceDetail, status, adminNote: f.adminNote },
        });
    setSaving(false);
    if (!r.ok) {
      setServerError(errorMessage(r.code));
      return;
    }
    toast.success(isCreate ? "เพิ่มการจองแล้ว" : status === "cancelled" && booking?.booking_status !== "cancelled" ? "ยกเลิกการจองแล้ว รอบนี้กลับมาว่าง" : "บันทึกแล้ว");
    setConfirmCancel(false);
    onSaved();
    onClose();
  }

  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  return (
    <>
      <Dialog
        open={open && !confirmCancel}
        onClose={onClose}
        wide
        title={isCreate ? "เพิ่มการจอง" : `Booking ${booking!.booking_code}`}
        footer={
          <>
            {!isCreate && booking!.booking_status !== "cancelled" && (
              <Button variant="danger" className="mr-auto" onClick={() => setConfirmCancel(true)} disabled={saving}>
                ยกเลิก Booking
              </Button>
            )}
            <Button variant="secondary" onClick={onClose} disabled={saving}>ปิด</Button>
            <Button onClick={() => save()} loading={saving}>{isCreate ? "เพิ่มการจอง" : "บันทึกการแก้ไข"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {serverError && <Alert kind="error">{serverError}</Alert>}
          {holiday && <Alert kind="warning">วันที่เลือกเป็นวันหยุดร้าน ({holiday}) — ไม่สามารถย้ายนัดมาวันนี้ได้</Alert>}
          {!isCreate && (
            <p className="text-xs text-neutral-500">
              สร้างเมื่อ {formatThaiDateTime(booking!.created_at)} · แก้ไขล่าสุด {formatThaiDateTime(booking!.updated_at)}
              {booking!.line_display_name ? ` · LINE: ${booking!.line_display_name}` : ""}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="e-date">วันที่</label>
              <input id="e-date" type="date" className={`input ${errors.date ? "input-error" : ""}`} value={f.date} onChange={(e) => set({ date: e.target.value })} />
              {errors.date && <p className="field-error">{errors.date}</p>}
            </div>
            <div>
              <label className="label" htmlFor="e-start">เวลา</label>
              <select id="e-start" className={`input ${errors.startTime ? "input-error" : ""}`} value={f.start} onChange={(e) => set({ start: e.target.value })}>
                <option value="">— เลือกรอบ —</option>
                {SLOT_STARTS.map((s) => {
                  const l = slotLabel(s);
                  return <option key={s} value={s} disabled={l.disabled}>{l.label}</option>;
                })}
              </select>
              {errors.startTime && <p className="field-error">{errors.startTime}</p>}
            </div>
            <div>
              <label className="label" htmlFor="e-name">ชื่อผู้จอง</label>
              <input id="e-name" className={`input ${errors.username ? "input-error" : ""}`} value={f.username} maxLength={100} onChange={(e) => set({ username: e.target.value })} />
              {errors.username && <p className="field-error">{errors.username}</p>}
            </div>
            <div>
              <label className="label" htmlFor="e-phone">เบอร์โทรศัพท์</label>
              <input id="e-phone" type="tel" inputMode="tel" className={`input ${errors.phone ? "input-error" : ""}`} value={f.phone} maxLength={20} onChange={(e) => set({ phone: e.target.value })} />
              {errors.phone && <p className="field-error">{errors.phone}</p>}
            </div>
            <div>
              <label className="label" htmlFor="e-svc">ประเภทบริการ</label>
              <select id="e-svc" className="input" value={f.serviceType} onChange={(e) => set({ serviceType: e.target.value as ServiceType })}>
                {SERVICE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {!isCreate && (
              <div>
                <label className="label" htmlFor="e-status">สถานะ</label>
                <select id="e-status" className="input" value={f.status} onChange={(e) => set({ status: e.target.value as BookingStatus })}>
                  {(Object.keys(STATUS_LABEL) as BookingStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="label" htmlFor="e-detail">รายละเอียดเพิ่มเติม {f.serviceType === "other" && <span className="text-red-600">*</span>}</label>
            <textarea id="e-detail" rows={2} maxLength={500} className={`input resize-none ${errors.serviceDetail ? "input-error" : ""}`} value={f.serviceDetail} onChange={(e) => set({ serviceDetail: e.target.value })} />
            {errors.serviceDetail && <p className="field-error">{errors.serviceDetail}</p>}
          </div>
          {!isCreate && (
            <div>
              <label className="label" htmlFor="e-note">หมายเหตุร้าน (ลูกค้าไม่เห็น)</label>
              <textarea id="e-note" rows={2} maxLength={1000} className="input resize-none" value={f.adminNote} onChange={(e) => set({ adminNote: e.target.value })} />
            </div>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmCancel}
        title="ยืนยันการยกเลิก Booking"
        danger
        loading={saving}
        confirmLabel="ยกเลิก Booking"
        message={
          <>
            ยกเลิกการจอง <strong>{booking?.booking_code}</strong> ของ <strong>{booking?.username}</strong> ใช่หรือไม่?
            <br />
            รอบเวลานี้จะกลับมาว่างให้ลูกค้าอื่นจองได้ทันที (ข้อมูลการจองยังถูกเก็บไว้ในสถานะ &quot;ยกเลิกแล้ว&quot;)
            {serverError && <span className="mt-2 block text-red-600">{serverError}</span>}
          </>
        }
        onConfirm={() => save("cancelled")}
        onClose={() => setConfirmCancel(false)}
      />
    </>
  );
}
