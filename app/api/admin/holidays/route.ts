import { withAdmin } from "@/lib/auth/withAdmin";
import { json, fail, readJson } from "@/lib/http";
import { bangkokToday, isYmd } from "@/lib/booking/dates";
import { cleanText } from "@/lib/validation/booking";

export const dynamic = "force-dynamic";

/** GET /api/admin/holidays?scope=upcoming|all */
export const GET = withAdmin(async (req, { supabase }) => {
  const scope = new URL(req.url).searchParams.get("scope");
  let q = supabase.from("holidays").select("*").order("holiday_date", { ascending: scope !== "all" });
  if (scope !== "all") q = q.gte("holiday_date", bangkokToday());
  const { data: holidays, error } = await q.limit(500);
  if (error) return fail("SERVER_ERROR", 500);

  // active bookings that fall on a holiday (need manual handling)
  const dates = (holidays ?? []).map((h) => h.holiday_date);
  let conflicts: unknown[] = [];
  if (dates.length) {
    const r = await supabase
      .from("bookings")
      .select("id, booking_code, booking_date, start_time, username, phone_number, booking_status")
      .in("booking_date", dates)
      .eq("booking_status", "confirmed")
      .order("booking_date")
      .order("start_time");
    conflicts = r.data ?? [];
  }
  return json({ ok: true, holidays, conflicts });
});

/** POST {date, note} — create or edit a holiday (atomic; never deletes bookings) */
export const POST = withAdmin(async (req, { supabase }) => {
  let body: Record<string, unknown>;
  try {
    body = (await readJson(req)) as Record<string, unknown>;
  } catch {
    return fail("INVALID_INPUT", 400);
  }
  if (!isYmd(body.date)) return fail("INVALID_INPUT", 422);
  const { data, error } = await supabase.rpc("admin_set_holiday", {
    p_date: body.date,
    p_note: cleanText(body.note, 300) || null,
  });
  if (error) return fail(error.code === "42501" ? "FORBIDDEN" : "SERVER_ERROR", error.code === "42501" ? 403 : 500);
  const r = data as { ok: boolean; code: string };
  return r.ok ? json(r) : fail(r.code, 409);
});

/** DELETE ?date=YYYY-MM-DD — cancel a holiday */
export const DELETE = withAdmin(async (req, { supabase }) => {
  const date = new URL(req.url).searchParams.get("date");
  if (!isYmd(date)) return fail("INVALID_INPUT", 400);
  const { error, count } = await supabase.from("holidays").delete({ count: "exact" }).eq("holiday_date", date);
  if (error) return fail("SERVER_ERROR", 500);
  return json({ ok: true, deleted: count ?? 0 });
});
