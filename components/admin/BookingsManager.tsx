"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Booking } from "@/types";
import { PageHeader } from "./AdminShell";
import { StatusBadge } from "./StatusBadge";
import { BookingEditDialog } from "./BookingEditDialog";
import { Button } from "@/components/ui/Button";
import { EmptyState, Alert } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/Spinner";
import { api } from "@/lib/apiClient";
import { SERVICE_LABEL, SERVICE_TYPES, STATUS_LABEL, errorMessage } from "@/lib/booking/constants";
import { formatThaiDate, formatThaiDateTime, hm } from "@/lib/booking/dates";
import { formatPhone } from "@/components/booking/BookingSummary";

export function BookingsManager() {
  const sp = useSearchParams();
  const [filters, setFilters] = useState({
    q: "",
    date: sp.get("date") ?? "",
    month: "",
    service: "",
    status: "",
    sort: sp.get("sort") === "created" ? "created" : "appointment",
  });
  const [qInput, setQInput] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [creating, setCreating] = useState(false);
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort: filters.sort });
    for (const k of ["q", "date", "month", "service", "status"] as const) if (filters[k]) p.set(k, filters[k]);
    const r = await api<{ bookings: Booking[]; total: number }>(`/api/admin/bookings?${p}`);
    setLoading(false);
    if (!r.ok) {
      setError(errorMessage(r.code));
      return;
    }
    setRows(r.data.bookings);
    setTotal(r.data.total);
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  // debounce search box
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setFilters((f) => (f.q === qInput ? f : { ...f, q: qInput }));
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const setFilter = (p: Partial<typeof filters>) => {
    setPage(1);
    setFilters((f) => ({ ...f, ...p }));
  };
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilter = filters.q || filters.date || filters.month || filters.service || filters.status;

  return (
    <div>
      <PageHeader
        title="Booking Management"
        subtitle={`รายการจองทั้งหมด ${total.toLocaleString("th-TH")} รายการ`}
        actions={<Button onClick={() => setCreating(true)}>+ เพิ่มการจอง</Button>}
      />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="q">ค้นหา</label>
          <input id="q" className="input" placeholder="ชื่อ / เบอร์โทร / Booking ID" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="fd">วันที่</label>
          <input id="fd" type="date" className="input" value={filters.date} onChange={(e) => setFilter({ date: e.target.value, month: "" })} />
        </div>
        <div>
          <label className="label" htmlFor="fm">เดือน</label>
          <input id="fm" type="month" className="input" value={filters.month} onChange={(e) => setFilter({ month: e.target.value, date: "" })} />
        </div>
        <div>
          <label className="label" htmlFor="fs">ประเภทบริการ</label>
          <select id="fs" className="input" value={filters.service} onChange={(e) => setFilter({ service: e.target.value })}>
            <option value="">ทั้งหมด</option>
            {SERVICE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="fst">สถานะ</label>
          <select id="fst" className="input" value={filters.status} onChange={(e) => setFilter({ status: e.target.value })}>
            <option value="">ทั้งหมด</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-6">
          <span className="text-sm text-neutral-500">เรียงตาม:</span>
          {(["appointment", "created"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter({ sort: s })}
              className={`rounded-full px-3 py-1.5 text-sm ${filters.sort === s ? "bg-brand-700 text-white" : "bg-neutral-100 text-neutral-700"}`}
            >
              {s === "appointment" ? "วันนัดหมาย" : "จองล่าสุด"}
            </button>
          ))}
          {hasFilter && (
            <button
              className="ml-auto text-sm font-semibold text-brand-700"
              onClick={() => {
                setQInput("");
                setFilter({ q: "", date: "", month: "", service: "", status: "" });
              }}
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-4"><Alert kind="error">{error} <button className="ml-2 font-semibold underline" onClick={load}>ลองใหม่</button></Alert></div>}

      {loading && rows.length === 0 ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState title="ไม่พบรายการจอง" description={hasFilter ? "ลองเปลี่ยนเงื่อนไขการค้นหา" : "เมื่อมีลูกค้าจอง รายการจะแสดงที่นี่"} />
      ) : (
        <>
          {/* Desktop table */}
          <div className={`card hidden overflow-x-auto md:block ${loading ? "opacity-60" : ""}`}>
            <table className="min-w-full divide-y divide-neutral-100">
              <thead className="bg-neutral-50">
                <tr>
                  {["Booking ID", "วันที่", "เวลา", "ชื่อผู้จอง", "เบอร์โทร", "บริการ", "รายละเอียด", "LINE", "สถานะ", "สร้างเมื่อ"].map((h) => (
                    <th key={h} className="table-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((b) => (
                  <tr key={b.id} onClick={() => setEditing(b)} className="cursor-pointer hover:bg-brand-50/40">
                    <td className="table-td font-mono text-xs">{b.booking_code}</td>
                    <td className="table-td">{formatThaiDate(b.booking_date, { weekday: false })}</td>
                    <td className="table-td tabular-nums">{hm(b.start_time)}–{hm(b.end_time)}</td>
                    <td className="table-td max-w-[160px] truncate font-medium">{b.username}</td>
                    <td className="table-td tabular-nums">{formatPhone(b.phone_number)}</td>
                    <td className="table-td">{SERVICE_LABEL[b.service_type]}</td>
                    <td className="table-td max-w-[180px] truncate text-neutral-500" title={b.service_detail ?? ""}>{b.service_detail ?? "–"}</td>
                    <td className="table-td max-w-[120px] truncate text-neutral-500">{b.line_display_name ?? "–"}</td>
                    <td className="table-td"><StatusBadge status={b.booking_status} /></td>
                    <td className="table-td text-xs text-neutral-500">{formatThaiDateTime(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className={`space-y-2 md:hidden ${loading ? "opacity-60" : ""}`}>
            {rows.map((b) => (
              <li key={b.id}>
                <button onClick={() => setEditing(b)} className="card w-full p-4 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{b.username}</p>
                      <p className="text-sm tabular-nums text-neutral-600">{formatPhone(b.phone_number)}</p>
                    </div>
                    <StatusBadge status={b.booking_status} />
                  </div>
                  <p className="mt-2 text-sm text-neutral-700">
                    {formatThaiDate(b.booking_date, { weekday: false })} · <span className="tabular-nums">{hm(b.start_time)}–{hm(b.end_time)}</span>
                  </p>
                  <p className="text-sm text-neutral-500">{SERVICE_LABEL[b.service_type]}{b.service_detail ? ` · ${b.service_detail}` : ""}</p>
                  <p className="mt-1 font-mono text-xs text-neutral-400">{b.booking_code}{b.line_display_name ? ` · LINE: ${b.line_display_name}` : ""}</p>
                </button>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ ก่อนหน้า</Button>
              <span className="text-sm text-neutral-600">หน้า {page} / {pages}</span>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>ถัดไป ›</Button>
            </div>
          )}
        </>
      )}

      <BookingEditDialog open={!!editing} booking={editing} onClose={() => setEditing(null)} onSaved={load} />
      <BookingEditDialog open={creating} booking={null} onClose={() => setCreating(false)} onSaved={load} />
    </div>
  );
}
