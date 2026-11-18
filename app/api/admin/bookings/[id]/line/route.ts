import { withAdmin } from "@/lib/auth/withAdmin";
import { json, fail } from "@/lib/http";
import { isUuid } from "@/lib/validation/booking";
import { hm } from "@/lib/booking/dates";
import { pushLine, explainPushFailure } from "@/lib/line/push";
import { getLineConfig } from "@/lib/line/config.server";
import { bookingConfirmedMessage } from "@/lib/line/messages";
import type { Booking } from "@/types";

export const dynamic = "force-dynamic";

/** POST — (re)send the booking confirmation to the customer's LINE and report why it failed */
export const POST = withAdmin<{ id: string }>(async (_req, { supabase }, { id }) => {
  if (!isUuid(id)) return fail("NOT_FOUND", 404);
  const { data, error } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  if (error) return fail("SERVER_ERROR", 500);
  if (!data) return fail("NOT_FOUND", 404);
  const b = data as Booking;
  if (!b.line_user_id) return json({ ok: false, message: explainPushFailure({ reason: "INVALID_TO" }) });
  const cfg = await getLineConfig();
  const r = await pushLine(b.line_user_id, [
    bookingConfirmedMessage(
      { bookingCode: b.booking_code, date: b.booking_date, start: hm(b.start_time), end: hm(b.end_time), username: b.username, serviceType: b.service_type },
      `https://liff.line.me/${cfg.liffId}`,
    ),
  ]);
  return json(r.ok ? { ok: true, message: "ส่งข้อความยืนยันไปที่ LINE ของลูกค้าแล้ว" } : { ok: false, message: explainPushFailure(r) });
});
