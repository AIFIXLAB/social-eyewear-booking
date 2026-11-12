import type { ServiceType } from "@/types";
import { SERVICE_LABEL } from "@/lib/booking/constants";
import { formatThaiDate } from "@/lib/booking/dates";

export function formatPhone(p: string): string {
  if (/^0\d{9}$/.test(p)) return `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;
  if (/^0\d{8}$/.test(p)) return `${p.slice(0, 2)}-${p.slice(2, 5)}-${p.slice(5)}`;
  return p;
}

export function BookingSummary({
  bookingCode,
  username,
  phone,
  serviceType,
  serviceDetail,
  date,
  start,
  end,
}: {
  bookingCode?: string;
  username: string;
  phone: string;
  serviceType: ServiceType;
  serviceDetail: string | null;
  date: string;
  start: string;
  end: string;
}) {
  const rows: [string, React.ReactNode][] = [
    ...(bookingCode ? [["Booking ID", <span key="c" className="font-mono text-base font-bold tracking-wider text-brand-800">{bookingCode}</span>] as [string, React.ReactNode]] : []),
    ["ชื่อผู้จอง", username],
    ["เบอร์โทรศัพท์", <span key="p" className="tabular-nums">{formatPhone(phone)}</span>],
    ["ประเภทบริการ", SERVICE_LABEL[serviceType]],
    ...(serviceDetail ? [["รายละเอียดเพิ่มเติม", <span key="d" className="whitespace-pre-line">{serviceDetail}</span>] as [string, React.ReactNode]] : []),
    ["วันที่นัดหมาย", formatThaiDate(date)],
    ["เวลานัดหมาย", <span key="t" className="tabular-nums">{start}–{end} น.</span>],
  ];
  return (
    <dl className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
          <dt className="shrink-0 text-sm text-neutral-500 sm:w-40">{k}</dt>
          <dd className="text-sm font-medium text-neutral-900 sm:text-base">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
