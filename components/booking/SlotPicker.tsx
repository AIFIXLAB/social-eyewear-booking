"use client";
import type { DayAvailability, DaySummary, SlotAvailability, SlotStatus } from "@/types";
import { formatThaiDate } from "@/lib/booking/dates";
import { Alert } from "@/components/ui/EmptyState";

const SLOT_STYLE: Record<SlotStatus, { cls: string; label: string }> = {
  available: { cls: "border-avail-border bg-avail-bg text-avail-text hover:bg-[#d8efe1] active:scale-[.98]", label: "ว่าง" },
  booked: { cls: "border-neutral-200 bg-neutral-100 text-neutral-400 line-through decoration-neutral-300", label: "ถูกจองแล้ว" },
  closed: { cls: "border-red-100 bg-red-50/60 text-red-400", label: "ปิดรอบ" },
  holiday: { cls: "border-red-100 bg-red-50/60 text-red-400", label: "วันหยุด" },
  past: { cls: "border-neutral-200 bg-neutral-50 text-neutral-300", label: "หมดเวลาจอง" },
  out_of_range: { cls: "border-neutral-200 bg-neutral-50 text-neutral-300", label: "ยังไม่เปิดจอง" },
};

export function SlotPicker({
  day,
  summary,
  selectedStart,
  onPick,
}: {
  day: DayAvailability;
  summary: DaySummary;
  selectedStart: string | null;
  onPick: (slot: SlotAvailability) => void;
}) {
  return (
    <section aria-labelledby="slots-heading">
      <div className="mb-3">
        <h3 id="slots-heading" className="text-base font-semibold text-neutral-900">
          {formatThaiDate(day.date)}
        </h3>
        {summary.status !== "holiday" && (
          <p className="mt-0.5 text-sm text-neutral-500">
            ว่าง {summary.available} รอบ · จองแล้ว {summary.booked} รอบ
            {summary.closed > 0 ? ` · ปิด ${summary.closed} รอบ` : ""}
          </p>
        )}
      </div>

      {summary.status === "holiday" ? (
        <Alert kind="error">
          <strong>วันหยุดร้าน</strong>
          {day.holidayNote ? ` — ${day.holidayNote}` : ""} กรุณาเลือกวันอื่น
        </Alert>
      ) : summary.available === 0 ? (
        <Alert kind="warning">ขออภัย คิวตรวจในวันนี้เต็มแล้ว กรุณาเลือกวันอื่น</Alert>
      ) : null}

      {summary.status !== "holiday" && (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {day.slots.map((s) => {
            const st = SLOT_STYLE[s.status];
            const enabled = s.status === "available";
            const sel = selectedStart === s.start;
            return (
              <li key={s.start}>
                <button
                  type="button"
                  disabled={!enabled}
                  onClick={() => onPick(s)}
                  aria-pressed={sel}
                  className={`flex min-h-[60px] w-full flex-col items-center justify-center rounded-xl border px-2 py-2 transition
                    ${st.cls} ${sel ? "ring-2 ring-brand-700 ring-offset-1" : ""} ${enabled ? "cursor-pointer" : "cursor-not-allowed"}`}
                >
                  <span className="text-base font-semibold tabular-nums">
                    {s.start}–{s.end}
                  </span>
                  <span className="text-xs">{st.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
