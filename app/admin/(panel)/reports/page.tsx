"use client";
import { useCallback, useEffect, useState } from "react";
import type { Booking } from "@/types";
import { PageHeader } from "@/components/admin/AdminShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState, Alert } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/Spinner";
import { api } from "@/lib/apiClient";
import { SERVICE_LABEL, SERVICE_TYPES, errorMessage } from "@/lib/booking/constants";
import { bangkokToday, formatThaiDate, formatThaiMonth, hm, isYm, isYmd, monthOf, monthRange } from "@/lib/booking/dates";
import { formatPhone } from "@/components/booking/BookingSummary";

interface Report {
  from: string;
  to: string;
  totals: { all: number; active: number; confirmed: number; completed: number; cancelled: number };
  byService: Record<string, number>;
  byDay: Record<string, number>;
  bookings: Booking[];
}

export default function ReportsPage() {
  const [mode, setMode] = useState<"day" | "month">("day");
  const [day, setDay] = useState(bangkokToday());
  const [month, setMonth] = useState(monthOf(bangkokToday()));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = mode === "day" ? { from: day, to: day } : monthRange(month);
  const valid = mode === "day" ? isYmd(day) : isYm(month);

  const load = useCallback(async () => {
    if (!valid) return;
    setLoading(true);
    const r = await api<Report>(`/api/admin/reports?from=${range.from}&to=${range.to}`);
    setLoading(false);
    if (!r.ok) return setError(errorMessage(r.code));
    setError(null);
    setReport(r.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, valid]);

  useEffect(() => {
    load();
  }, [load]);

  const title = mode === "day" ? formatThaiDate(day) : formatThaiMonth(month);
  const maxDay = report ? Math.max(1, ...Object.values(report.byDay)) : 1;

  return (
    <div>
      <PageHeader
        title="Reports & Export"
        subtitle="รายงานรายวัน / รายเดือน และส่งออกข้อมูล"
        actions={
          <>
            <Button variant="secondary" onClick={() => window.print()}>พิมพ์</Button>
            <a
              href={`/api/admin/export?from=${range.from}&to=${range.to}`}
              className="inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Export CSV (Excel)
            </a>
          </>
        }
      />

      <div className="card no-print mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="flex rounded-xl bg-neutral-100 p-1">
          {(["day", "month"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`min-h-9 rounded-lg px-4 text-sm font-semibold ${mode === m ? "bg-white shadow" : "text-neutral-500"}`}>
              {m === "day" ? "รายวัน" : "รายเดือน"}
            </button>
          ))}
        </div>
        {mode === "day" ? (
          <input type="date" aria-label="วันที่" className="input w-auto" value={day} onChange={(e) => setDay(e.target.value)} />
        ) : (
          <input type="month" aria-label="เดือน" className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
        )}
      </div>

      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {error && <Alert kind="error">{error}</Alert>}
      {loading && !report ? (
        <LoadingBlock />
      ) : report ? (
        <div className={loading ? "opacity-60" : ""}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Booking ทั้งหมด (ไม่รวมยกเลิก)", report.totals.active],
              ["รอเข้ารับบริการ", report.totals.confirmed],
              ["เข้ารับบริการแล้ว", report.totals.completed],
              ["ยกเลิก", report.totals.cancelled],
            ].map(([l, v]) => (
              <div key={l as string} className="card p-4">
                <p className="text-xs text-neutral-500">{l}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{v}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="card p-4">
              <h3 className="mb-3 font-semibold">สรุปตามประเภทบริการ</h3>
              <ul className="space-y-2">
                {SERVICE_TYPES.map((s) => {
                  const n = report.byService[s.value] ?? 0;
                  const pct = report.totals.active ? Math.round((n / report.totals.active) * 100) : 0;
                  return (
                    <li key={s.value}>
                      <div className="flex justify-between text-sm"><span>{s.label}</span><span className="tabular-nums">{n} ({pct}%)</span></div>
                      <div className="mt-1 h-2 rounded-full bg-neutral-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${pct}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
            </div>
            {mode === "month" && (
              <div className="card p-4">
                <h3 className="mb-3 font-semibold">จำนวนการจองรายวัน</h3>
                {Object.keys(report.byDay).length === 0 ? (
                  <p className="text-sm text-neutral-500">ไม่มีข้อมูล</p>
                ) : (
                  <ul className="max-h-72 space-y-1 overflow-y-auto pr-1 text-sm">
                    {Object.entries(report.byDay).map(([d, n]) => (
                      <li key={d} className="flex items-center gap-2">
                        <button className="w-20 shrink-0 text-left tabular-nums text-brand-700 hover:underline" onClick={() => { setMode("day"); setDay(d); }}>
                          {Number(d.slice(8))} {formatThaiMonth(d.slice(0, 7)).split(" ")[0].slice(0, 3)}
                        </button>
                        <div className="h-3 flex-1 rounded bg-neutral-100"><div className="h-3 rounded bg-brand-500" style={{ width: `${(n / maxDay) * 100}%` }} /></div>
                        <span className="w-6 text-right tabular-nums">{n}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="mt-4">
            <h3 className="mb-2 font-semibold">รายการนัดหมาย ({report.bookings.length})</h3>
            {report.bookings.length === 0 ? (
              <EmptyState title="ไม่มีนัดหมายในช่วงนี้" />
            ) : (
              <div className="card overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-100">
                  <thead className="bg-neutral-50">
                    <tr>{[mode === "month" ? "วันที่" : null, "เวลา", "ชื่อ", "เบอร์โทร", "บริการ", "รายละเอียด", "สถานะ", "Booking ID"].filter(Boolean).map((h) => <th key={h!} className="table-th">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {report.bookings.map((b) => (
                      <tr key={b.id} className={b.booking_status === "cancelled" ? "text-neutral-400" : ""}>
                        {mode === "month" && <td className="table-td">{formatThaiDate(b.booking_date, { weekday: false })}</td>}
                        <td className="table-td tabular-nums">{hm(b.start_time)}–{hm(b.end_time)}</td>
                        <td className="table-td font-medium">{b.username}</td>
                        <td className="table-td tabular-nums">{formatPhone(b.phone_number)}</td>
                        <td className="table-td">{SERVICE_LABEL[b.service_type]}</td>
                        <td className="table-td max-w-[220px] truncate">{b.service_detail ?? "–"}</td>
                        <td className="table-td"><StatusBadge status={b.booking_status} /></td>
                        <td className="table-td font-mono text-xs">{b.booking_code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
