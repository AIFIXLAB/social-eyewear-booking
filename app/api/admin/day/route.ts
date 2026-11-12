import { withAdmin } from "@/lib/auth/withAdmin";
import { json, fail } from "@/lib/http";
import { isYmd } from "@/lib/booking/dates";
import { SLOT_STARTS, slotEnd } from "@/lib/booking/constants";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/day?date=YYYY-MM-DD
 * Everything about one day for the admin: 9 slots with status, the
 * active booking in each slot, closures, holiday, and cancelled bookings.
 */
export const GET = withAdmin(async (req, { supabase }) => {
  const date = new URL(req.url).searchParams.get("date");
  if (!isYmd(date)) return fail("INVALID_INPUT", 400);

  const [avail, bookings, overrides, holiday] = await Promise.all([
    supabase.rpc("get_availability", { p_from: date, p_to: date }),
    supabase.from("bookings").select("*").eq("booking_date", date).order("start_time"),
    supabase.from("slot_overrides").select("*").eq("slot_date", date),
    supabase.from("holidays").select("*").eq("holiday_date", date).maybeSingle(),
  ]);
  if (avail.error || bookings.error || overrides.error || holiday.error) return fail("SERVER_ERROR", 500);

  const statusByStart = new Map<string, string>(
    (avail.data ?? []).map((r: { start_time: string; status: string }) => [r.start_time.slice(0, 5), r.status]),
  );
  const slots = SLOT_STARTS.map((start) => {
    const active = (bookings.data ?? []).find((b) => b.start_time.slice(0, 5) === start && b.booking_status !== "cancelled") ?? null;
    const override = (overrides.data ?? []).find((o) => o.start_time.slice(0, 5) === start) ?? null;
    return {
      start,
      end: slotEnd(start),
      publicStatus: statusByStart.get(start) ?? "available",
      booking: active,
      closed: !!override,
      closeNote: override?.note ?? null,
    };
  });

  return json({
    ok: true,
    date,
    holiday: holiday.data,
    slots,
    cancelled: (bookings.data ?? []).filter((b) => b.booking_status === "cancelled"),
  });
});
