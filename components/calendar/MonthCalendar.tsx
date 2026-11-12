"use client";
import type { DayStatus, DaySummary } from "@/types";
import { THAI_WEEKDAYS_SHORT, formatThaiMonth, monthGrid } from "@/lib/booking/dates";

export const DAY_STYLES: Record<DayStatus, { cell: string; dot: string; label: string }> = {
  available: { cell: "bg-avail-bg border-avail-border text-avail-text hover:bg-[#d8efe1]", dot: "bg-[#3fae6c]", label: "ว่าง" },
  partial: { cell: "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100", dot: "bg-amber-500", label: "จองแล้วบางรอบ" },
  full: { cell: "bg-neutral-100 border-neutral-200 text-neutral-400", dot: "bg-neutral-400", label: "เต็ม" },
  holiday: { cell: "bg-red-50 border-red-200 text-red-700", dot: "bg-red-500", label: "วันหยุดร้าน" },
  closed: { cell: "bg-neutral-100 border-neutral-200 text-neutral-400", dot: "bg-neutral-300", label: "ปิดรับจอง" },
  unavailable: { cell: "bg-white border-transparent text-neutral-300", dot: "bg-transparent", label: "" },
};

export function CalendarLegend() {
  const items: DayStatus[] = ["available", "partial", "full", "holiday"];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-600">
      {items.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${DAY_STYLES[s].dot}`} />
          {s === "full" ? "เต็มทั้ง 9 รอบ" : DAY_STYLES[s].label}
        </li>
      ))}
    </ul>
  );
}

export function MonthCalendar({
  month,
  summaries,
  selected,
  today,
  onSelect,
  onPrev,
  onNext,
  canPrev,
  canNext,
  loading,
  selectableStatuses = ["available", "partial", "full", "holiday", "closed"],
  showCounts = true,
}: {
  month: string;
  summaries: Record<string, DaySummary>;
  selected: string | null;
  today: string;
  onSelect: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  loading?: boolean;
  selectableStatuses?: DayStatus[];
  showCounts?: boolean;
}) {
  const cells = monthGrid(month);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="เดือนก่อนหน้า"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 text-lg text-neutral-700 hover:bg-neutral-50 disabled:opacity-30"
        >
          ‹
        </button>
        <h2 className="text-lg font-semibold text-neutral-900" aria-live="polite">
          {formatThaiMonth(month)}
        </h2>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          aria-label="เดือนถัดไป"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 text-lg text-neutral-700 hover:bg-neutral-50 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-neutral-500">
        {THAI_WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      <div className={`mt-1 grid grid-cols-7 gap-1 ${loading ? "opacity-50" : ""}`} role="grid" aria-busy={loading}>
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} />;
          const s = summaries[date];
          const status: DayStatus = s?.status ?? "unavailable";
          const style = DAY_STYLES[status];
          const selectable = !!s && selectableStatuses.includes(status);
          const isSel = selected === date;
          const isToday = date === today;
          const dayNum = Number(date.slice(8));
          return (
            <button
              key={date}
              type="button"
              disabled={!selectable}
              onClick={() => onSelect(date)}
              aria-pressed={isSel}
              aria-label={`${dayNum} ${style.label}${s && showCounts && status !== "holiday" ? ` ว่าง ${s.available} รอบ` : ""}`}
              className={`relative flex aspect-square min-h-[44px] flex-col items-center justify-center rounded-xl border text-sm transition
                ${style.cell} ${isSel ? "ring-2 ring-brand-700 ring-offset-1" : ""} ${selectable ? "cursor-pointer" : "cursor-default"}`}
            >
              <span className={`font-semibold ${isToday ? "underline decoration-2 underline-offset-4" : ""}`}>{dayNum}</span>
              {s && showCounts && (status === "available" || status === "partial") && (
                <span className="text-[10px] leading-tight sm:text-[11px]">ว่าง {s.available}</span>
              )}
              {s && status === "full" && <span className="text-[10px] leading-tight sm:text-[11px]">เต็ม</span>}
              {s && status === "holiday" && <span className="text-[10px] leading-tight sm:text-[11px]">หยุด</span>}
              {s && status === "closed" && <span className="text-[10px] leading-tight sm:text-[11px]">ปิด</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
