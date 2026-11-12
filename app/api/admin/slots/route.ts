import { withAdmin } from "@/lib/auth/withAdmin";
import { json, fail, readJson } from "@/lib/http";
import { isYmd } from "@/lib/booking/dates";
import { isStandardSlot } from "@/lib/booking/constants";
import { cleanText } from "@/lib/validation/booking";

export const dynamic = "force-dynamic";

/**
 * POST {date, start, note, force} — close a slot.
 * Without force, refuses if a booking exists (returns HAS_BOOKING + the booking)
 * so the UI can warn the admin first.
 */
export const POST = withAdmin(async (req, { supabase }) => {
  let b: Record<string, unknown>;
  try {
    b = (await readJson(req)) as Record<string, unknown>;
  } catch {
    return fail("INVALID_INPUT", 400);
  }
  if (!isYmd(b.date) || typeof b.start !== "string" || !isStandardSlot(b.start)) return fail("INVALID_INPUT", 422);
  const { data, error } = await supabase.rpc("admin_close_slot", {
    p_date: b.date,
    p_start: b.start,
    p_note: cleanText(b.note, 300) || null,
    p_force: b.force === true,
  });
  if (error) return fail("SERVER_ERROR", 500);
  const r = data as { ok: boolean; code: string };
  return r.ok ? json(r) : json(r, 409);
});

/** DELETE ?date=&start= — re-open a closed slot */
export const DELETE = withAdmin(async (req, { supabase }) => {
  const sp = new URL(req.url).searchParams;
  const date = sp.get("date");
  const start = sp.get("start");
  if (!isYmd(date) || !start || !isStandardSlot(start)) return fail("INVALID_INPUT", 400);
  const { data, error } = await supabase.rpc("admin_open_slot", { p_date: date, p_start: start });
  if (error) return fail("SERVER_ERROR", 500);
  return json(data);
});
