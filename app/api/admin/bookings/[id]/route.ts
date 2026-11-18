import { withAdmin } from "@/lib/auth/withAdmin";
import { json, fail, readJson } from "@/lib/http";
import { isUuid, validateAdminUpdate } from "@/lib/validation/booking";
import { pushLine } from "@/lib/line/push";
import { bookingCancelledMessage, bookingChangedMessage } from "@/lib/line/messages";
import { hm } from "@/lib/booking/dates";
import type { Booking } from "@/types";

export const dynamic = "force-dynamic";

export const GET = withAdmin<{ id: string }>(async (_req, { supabase }, { id }) => {
  if (!isUuid(id)) return fail("NOT_FOUND", 404);
  const { data, error } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  if (error) return fail("SERVER_ERROR", 500);
  if (!data) return fail("NOT_FOUND", 404);
  return json({ ok: true, booking: data });
});

/** PATCH — edit details, move date/time, change status (incl. cancel). Atomic in SQL. */
export const PATCH = withAdmin<{ id: string }>(async (req, { supabase }, { id }) => {
  if (!isUuid(id)) return fail("NOT_FOUND", 404);
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return fail("INVALID_INPUT", 400);
  }
  const v = validateAdminUpdate(body);
  if (!v.ok) return fail("INVALID_INPUT", 422, { errors: v.errors });
  const u = v.value;
  const notify = (body as { notifyLine?: unknown }).notifyLine !== false;

  const { data: before } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();

  const { data, error } = await supabase.rpc("admin_update_booking", {
    p_id: id,
    p_booking_date: u.date,
    p_start_time: u.startTime,
    p_username: u.username,
    p_phone_number: u.phone,
    p_service_type: u.serviceType,
    p_service_detail: u.serviceDetail,
    p_status: u.status,
    p_admin_note: u.adminNote,
  });
  if (error) {
    if (error.code === "42501") return fail("FORBIDDEN", 403);
    console.error(error.message);
    return fail("SERVER_ERROR", 500);
  }
  const r = data as { ok: boolean; code: string; booking?: unknown };
  if (!r.ok) return fail(r.code, r.code === "NOT_FOUND" ? 404 : 409);

  // Tell the customer on LINE when the shop cancels or moves their appointment
  let lineNotified: boolean | null = null;
  const after = r.booking as Booking | undefined;
  const prev = before as Booking | null;
  if (notify && after?.line_user_id && prev) {
    const info = { bookingCode: after.booking_code, date: after.booking_date, start: hm(after.start_time), end: hm(after.end_time), username: after.username, serviceType: after.service_type };
    const cancelledNow = prev.booking_status !== "cancelled" && after.booking_status === "cancelled";
    const moved = after.booking_status === "confirmed" && (prev.booking_date !== after.booking_date || hm(prev.start_time) !== hm(after.start_time));
    if (cancelledNow) lineNotified = (await pushLine(after.line_user_id, [bookingCancelledMessage(info)])).ok;
    else if (moved) lineNotified = (await pushLine(after.line_user_id, [bookingChangedMessage(info)])).ok;
  }
  return json({ ...r, lineNotified });
});
