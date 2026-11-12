import { withAdmin } from "@/lib/auth/withAdmin";
import { fail } from "@/lib/http";
import { addDays, formatThaiDateTime, hm, isYmd } from "@/lib/booking/dates";
import { SERVICE_LABEL, STATUS_LABEL } from "@/lib/booking/constants";
import { STATUS_VALUES } from "@/lib/validation/booking";
import { toCsv } from "@/lib/booking/csv";
import type { Booking } from "@/types";

export const dynamic = "force-dynamic";

/** GET /api/admin/export?from=&to=&status= → CSV (UTF-8 BOM, opens in Excel with Thai) */
export const GET = withAdmin(async (req, { supabase }) => {
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const status = sp.get("status");
  if (!isYmd(from) || !isYmd(to) || to < from || to > addDays(from, 366)) return fail("INVALID_INPUT", 400);

  const rows: Booking[] = [];
  for (let i = 0; ; i += 1000) {
    let q = supabase
      .from("bookings")
      .select("*")
      .gte("booking_date", from)
      .lte("booking_date", to)
      .order("booking_date")
      .order("start_time")
      .range(i, i + 999);
    if (status && (STATUS_VALUES as string[]).includes(status)) q = q.eq("booking_status", status);
    const { data, error } = await q;
    if (error) return fail("SERVER_ERROR", 500);
    rows.push(...(data as Booking[]));
    if (!data || data.length < 1000) break;
  }

  const csv = toCsv(
    ["Booking ID", "วันที่", "เวลา", "ชื่อผู้จอง", "เบอร์โทรศัพท์", "ประเภทบริการ", "รายละเอียดเพิ่มเติม",
     "LINE Display Name", "สถานะ", "หมายเหตุร้าน", "สร้างเมื่อ"],
    rows.map((b) => [
      b.booking_code,
      b.booking_date,
      `${hm(b.start_time)}-${hm(b.end_time)}`,
      b.username,
      b.phone_number,
      SERVICE_LABEL[b.service_type],
      b.service_detail,
      b.line_display_name,
      STATUS_LABEL[b.booking_status],
      b.admin_note,
      formatThaiDateTime(b.created_at),
    ]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="social-eyewear-bookings_${from}_${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
