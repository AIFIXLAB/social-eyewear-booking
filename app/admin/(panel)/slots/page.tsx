"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/admin/AdminShell";
import { DayManager } from "@/components/admin/DayManager";
import { addDays, bangkokToday, isYmd } from "@/lib/booking/dates";

function Slots() {
  const sp = useSearchParams();
  const initial = sp.get("date");
  const [date, setDate] = useState(isYmd(initial) ? initial : bangkokToday());
  return (
    <div>
      <PageHeader title="Slot Management" subtitle="ปิดหรือเปิดรอบตรวจเป็นรายช่วงเวลา" />
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="sd">เลือกวันที่</label>
          <input id="sd" type="date" className="input" value={date} onChange={(e) => isYmd(e.target.value) && setDate(e.target.value)} />
        </div>
        <button className="min-h-11 rounded-xl border border-neutral-300 px-4 text-sm font-semibold" onClick={() => setDate(addDays(date, -1))}>‹ วันก่อน</button>
        <button className="min-h-11 rounded-xl border border-neutral-300 px-4 text-sm font-semibold" onClick={() => setDate(bangkokToday())}>วันนี้</button>
        <button className="min-h-11 rounded-xl border border-neutral-300 px-4 text-sm font-semibold" onClick={() => setDate(addDays(date, 1))}>วันถัดไป ›</button>
      </div>
      <div className="card p-4 sm:p-6">
        <DayManager key={date} date={date} />
      </div>
    </div>
  );
}

export default function SlotsPage() {
  return (
    <Suspense>
      <Slots />
    </Suspense>
  );
}
