"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DaySummary } from "@/types";
import { PageHeader } from "@/components/admin/AdminShell";
import { DayManager } from "@/components/admin/DayManager";
import { MonthCalendar, CalendarLegend } from "@/components/calendar/MonthCalendar";
import { Alert } from "@/components/ui/EmptyState";
import { api } from "@/lib/apiClient";
import { addMonths, bangkokToday, isYmd, monthOf } from "@/lib/booking/dates";
import { errorMessage } from "@/lib/booking/constants";

function AdminCalendar() {
  const sp = useSearchParams();
  const initial = sp.get("date");
  const today = bangkokToday();
  const [selected, setSelected] = useState<string>(isYmd(initial) ? initial : today);
  const [month, setMonth] = useState(monthOf(selected));
  const [summaries, setSummaries] = useState<Record<string, DaySummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<{ days: { date: string; summary: DaySummary }[] }>(`/api/availability?month=${month}`);
    setLoading(false);
    if (!r.ok) return setError(errorMessage(r.code));
    setError(null);
    const m: Record<string, DaySummary> = {};
    for (const d of r.data.days) {
      // admins can open any day, including past / full ones
      m[d.date] = d.summary.status === "unavailable" && d.summary.booked > 0 ? { ...d.summary, status: "full" } : d.summary;
    }
    setSummaries(m);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Calendar Management" subtitle="ภาพรวมรายเดือน · แตะวันที่เพื่อดูและจัดการรอบตรวจ" />
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <div className="card no-print h-fit p-4 sm:p-5">
          <MonthCalendar
            month={month}
            summaries={summaries}
            selected={selected}
            today={today}
            onSelect={setSelected}
            onPrev={() => setMonth(addMonths(month, -1))}
            onNext={() => setMonth(addMonths(month, 1))}
            canPrev
            canNext
            loading={loading}
            selectableStatuses={["available", "partial", "full", "holiday", "closed", "unavailable"]}
          />
          <div className="mt-4 border-t border-neutral-100 pt-3"><CalendarLegend /></div>
        </div>
        <div className="card p-4 sm:p-6">
          <DayManager key={selected} date={selected} onChanged={load} />
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense>
      <AdminCalendar />
    </Suspense>
  );
}
