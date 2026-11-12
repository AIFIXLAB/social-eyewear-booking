/**
 * Date helpers. All "calendar" dates are plain YYYY-MM-DD strings that
 * represent days in Asia/Bangkok. We never use the device timezone to
 * decide what "today" is.
 */
export const TZ = "Asia/Bangkok";

const ymdFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
});

/** Today's date in Bangkok as YYYY-MM-DD */
export function bangkokToday(now: Date = new Date()): string {
  return ymdFmt.format(now);
}

/** Current Bangkok time as HH:MM */
export function bangkokTimeHM(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now);
}

export function isYmd(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isYm(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

/** Pure date arithmetic on YYYY-MM-DD (UTC-based, timezone-safe) */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function monthOf(ymd: string): string {
  return ymd.slice(0, 7);
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return dt.toISOString().slice(0, 7);
}

/** First and last day of a YYYY-MM month */
export function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

/** Day of week, 0 = Sunday */
export function weekday(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Calendar grid for a month: leading nulls so the 1st falls on its weekday */
export function monthGrid(ym: string): (string | null)[] {
  const { from, to } = monthRange(ym);
  const cells: (string | null)[] = Array(weekday(from)).fill(null);
  for (let d = from; d <= to; d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
export const THAI_WEEKDAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
export const THAI_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

/** "พฤหัสบดีที่ 12 พฤศจิกายน 2569" (Buddhist year) */
export function formatThaiDate(ymd: string, opts: { weekday?: boolean; buddhist?: boolean } = {}): string {
  const { weekday: wd = true, buddhist = true } = opts;
  const [y, m, d] = ymd.split("-").map(Number);
  const year = buddhist ? y + 543 : y;
  const base = `${d} ${THAI_MONTHS[m - 1]} ${year}`;
  return wd ? `วัน${THAI_WEEKDAYS[weekday(ymd)]}ที่ ${base}` : base;
}

export function formatThaiMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
}

/** "14:00:00" → "14:00" */
export function hm(time: string): string {
  return time.slice(0, 5);
}

export function formatThaiDateTime(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TZ, dateStyle: "medium", timeStyle: "short",
  }).format(new Date(iso));
}
