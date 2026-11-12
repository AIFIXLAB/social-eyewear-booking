import { withAdmin } from "@/lib/auth/withAdmin";
import { json, fail } from "@/lib/http";
import { addDays, isYmd } from "@/lib/booking/dates";
import type { Booking } from "@/types";

export const dynamic = "force-dynamic";

/** GET /api/admin/reports?from=&to= — summary counts + the bookings in range */
export const GET = withAdmin(async (req, { supabase }) => {
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  if (!isYmd(from) || !isYmd(to) || to < from || to > addDays(from, 366)) return fail("INVALID_INPUT", 400);

  const all: Booking[] = [];
  const PAGE = 1000;
  for (let i = 0; ; i += PAGE) {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .gte("booking_date", from)
      .lte("booking_date", to)
      .order("booking_date")
      .order("start_time")
      .range(i, i + PAGE - 1);
    if (error) return fail("SERVER_ERROR", 500);
    all.push(...(data as Booking[]));
    if (!data || data.length < PAGE) break;
  }

  const byStatus = { confirmed: 0, completed: 0, cancelled: 0 };
  const byService: Record<string, number> = { eye_exam: 0, repair: 0, pickup: 0, other: 0 };
  const byDay: Record<string, number> = {};
  for (const b of all) {
    byStatus[b.booking_status] += 1;
    if (b.booking_status !== "cancelled") {
      byService[b.service_type] = (byService[b.service_type] ?? 0) + 1;
      byDay[b.booking_date] = (byDay[b.booking_date] ?? 0) + 1;
    }
  }
  return json({
    ok: true,
    from,
    to,
    totals: { all: all.length, active: all.length - byStatus.cancelled, ...byStatus },
    byService,
    byDay,
    bookings: all,
  });
});
