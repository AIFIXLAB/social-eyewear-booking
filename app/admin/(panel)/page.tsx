import Link from "next/link";
import { getAdmin } from "@/lib/auth/admin";
import { PageHeader } from "@/components/admin/AdminShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { bangkokToday, formatThaiDate, formatThaiDateTime, hm } from "@/lib/booking/dates";
import { SERVICE_LABEL } from "@/lib/booking/constants";
import type { Booking } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const admin = await getAdmin();
  if (!admin) return null;
  const { supabase } = admin;
  const today = bangkokToday();

  const [avail, todayBookings, future, recent, holidayConflicts] = await Promise.all([
    supabase.rpc("get_availability", { p_from: today, p_to: today }),
    supabase.from("bookings").select("*").eq("booking_date", today).neq("booking_status", "cancelled").order("start_time"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).gt("booking_date", today).eq("booking_status", "confirmed"),
    supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(8),
    supabase.from("holidays").select("holiday_date").gte("holiday_date", today),
  ]);

  const slots = (avail.data ?? []) as { status: string }[];
  const count = (s: string) => slots.filter((x) => x.status === s).length;
  const isHoliday = slots.length > 0 && slots.every((s) => s.status === "holiday");

  let conflictCount = 0;
  const hdates = (holidayConflicts.data ?? []).map((h) => h.holiday_date);
  if (hdates.length) {
    const r = await supabase.from("bookings").select("id", { count: "exact", head: true }).in("booking_date", hdates).eq("booking_status", "confirmed");
    conflictCount = r.count ?? 0;
  }

  const stats = [
    { label: "การจองวันนี้", value: todayBookings.data?.length ?? 0, tone: "brand" },
    { label: "รอบว่างวันนี้", value: isHoliday ? 0 : count("available"), tone: "green" },
    { label: "รอบที่ถูกจองแล้ว", value: count("booked"), tone: "amber" },
    { label: "รอบที่ปิด", value: isHoliday ? 9 : count("closed"), tone: "red" },
    { label: "การจองในอนาคต", value: future.count ?? 0, tone: "neutral" },
  ];
  const toneCls: Record<string, string> = {
    brand: "bg-brand-700 text-white",
    green: "bg-avail-bg text-avail-text",
    amber: "bg-amber-50 text-amber-900",
    red: "bg-red-50 text-red-700",
    neutral: "bg-white text-neutral-900",
  };

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`${formatThaiDate(today)}${isHoliday ? " · วันหยุดร้าน" : ""}`} />

      {conflictCount > 0 && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ มี {conflictCount} การจองที่ตรงกับวันหยุดร้าน — กรุณาติดต่อลูกค้าเพื่อเลื่อนหรือยกเลิก{" "}
          <Link href="/admin/holidays" className="font-semibold underline">ดูรายการ</Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-2xl border border-neutral-200/70 p-4 shadow-card ${toneCls[s.tone]}`}>
            <p className="text-xs font-medium opacity-80">{s.label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">นัดหมายวันนี้</h2>
            <Link href={`/admin/calendar?date=${today}`} className="text-sm font-semibold text-brand-700">ดูรายละเอียด ›</Link>
          </div>
          {(todayBookings.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">ยังไม่มีนัดหมายวันนี้</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {(todayBookings.data as Booking[]).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold tabular-nums">{hm(b.start_time)}–{hm(b.end_time)} · {b.username}</p>
                    <p className="truncate text-sm text-neutral-500">{SERVICE_LABEL[b.service_type]} · {b.phone_number}</p>
                  </div>
                  <StatusBadge status={b.booking_status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">รายการจองล่าสุด</h2>
            <Link href="/admin/bookings?sort=created" className="text-sm font-semibold text-brand-700">ทั้งหมด ›</Link>
          </div>
          {(recent.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">ยังไม่มีการจอง</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {(recent.data as Booking[]).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{b.username} <span className="font-mono text-xs text-neutral-400">{b.booking_code}</span></p>
                    <p className="text-sm text-neutral-500">
                      นัด {formatThaiDate(b.booking_date, { weekday: false })} {hm(b.start_time)} · จองเมื่อ {formatThaiDateTime(b.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={b.booking_status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
