import { json, fail } from "@/lib/http";
import { createSupabaseAnonClient } from "@/lib/supabase/service";
import { BOOKING_SERVER_TOKEN } from "@/lib/booking/serverToken.server";
import { addDays, bangkokToday, hm } from "@/lib/booking/dates";
import { bookingReminderMessage } from "@/lib/line/messages";
import { lineMessagingConfigured, pushLine } from "@/lib/line/push";
import type { ServiceType } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/line-reminders
 * Run once a day by Vercel Cron (vercel.json, 18:00 Bangkok).
 * Sends a LINE reminder for every confirmed booking TOMORROW that was made
 * through LINE and hasn't been reminded yet. Safe to call repeatedly.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return fail("FORBIDDEN", 403);
  if (!(await lineMessagingConfigured())) return json({ ok: true, skipped: "LINE channel access token not set" });

  const url = new URL(req.url);
  const date = url.searchParams.get("date") && secret ? url.searchParams.get("date")! : addDays(bangkokToday(), 1);

  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.rpc("get_due_reminders", { p_date: date, p_token: BOOKING_SERVER_TOKEN });
  if (error) {
    console.error("get_due_reminders failed", error.message);
    return fail("SERVER_ERROR", 500, { detail: error.message.slice(0, 200) });
  }

  type Row = { id: string; booking_code: string; booking_date: string; start_time: string; end_time: string; username: string; service_type: ServiceType; line_user_id: string };
  const rows = (data ?? []) as Row[];
  const sent: string[] = [];
  const failed: { code: string; reason: string }[] = [];

  for (const r of rows) {
    const res = await pushLine(
      r.line_user_id,
      [bookingReminderMessage({ bookingCode: r.booking_code, date: r.booking_date, start: hm(r.start_time), end: hm(r.end_time), username: r.username, serviceType: r.service_type })],
      r.id, // booking id as retry key → never sends the same reminder twice
    );
    if (res.ok) sent.push(r.id);
    else failed.push({ code: r.booking_code, reason: res.reason });
  }

  if (sent.length) {
    const m = await supabase.rpc("mark_reminders_sent", { p_ids: sent, p_token: BOOKING_SERVER_TOKEN });
    if (m.error) console.error("mark_reminders_sent failed", m.error.message);
  }
  return json({ ok: true, date, due: rows.length, sent: sent.length, failed });
}
