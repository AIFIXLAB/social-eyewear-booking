import { json, fail, rateLimit, clientIp } from "@/lib/http";
import { createSupabaseAnonClient } from "@/lib/supabase/service";
import { groupAvailability, summarizeDay } from "@/lib/booking/calendar";
import { bangkokToday, isYm, isYmd, monthRange, addDays } from "@/lib/booking/dates";

export const dynamic = "force-dynamic";

/**
 * GET /api/availability?month=YYYY-MM   (or ?from=YYYY-MM-DD&to=YYYY-MM-DD)
 * Public. Returns slot statuses only — never names, phones or LINE ids.
 */
export async function GET(req: Request) {
  if (!rateLimit(`avail:${clientIp(req)}`, 120, 60_000)) return fail("RATE_LIMITED", 429);

  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  let from = url.searchParams.get("from");
  let to = url.searchParams.get("to");
  if (month) {
    if (!isYm(month)) return fail("INVALID_INPUT", 400);
    ({ from, to } = monthRange(month));
  }
  if (!isYmd(from) || !isYmd(to) || to < from || to > addDays(from, 62)) return fail("INVALID_INPUT", 400);

  let supabase;
  try {
    supabase = createSupabaseAnonClient();
  } catch {
    return fail("SERVER_NOT_CONFIGURED", 503);
  }

  const [avail, settings] = await Promise.all([
    supabase.rpc("get_availability", { p_from: from, p_to: to }),
    supabase.rpc("get_public_settings"),
  ]);
  if (avail.error) {
    console.error("get_availability failed", avail.error.message);
    return fail("SERVER_ERROR", 500);
  }

  const days = groupAvailability(avail.data ?? []);
  return json({
    ok: true,
    today: bangkokToday(),
    from,
    to,
    settings: settings.data ?? {},
    days: days.map((d) => ({ ...d, summary: summarizeDay(d) })),
    fetchedAt: new Date().toISOString(),
  });
}
