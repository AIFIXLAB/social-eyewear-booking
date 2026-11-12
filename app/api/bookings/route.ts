import { json, fail, readJson, rateLimit, clientIp, sameOrigin } from "@/lib/http";
import { createSupabaseAnonClient } from "@/lib/supabase/service";
import { BOOKING_SERVER_TOKEN } from "@/lib/booking/serverToken.server";
import { validateBookingRequest } from "@/lib/validation/booking";
import { verifyLineIdToken } from "@/lib/line/verify";
import type { Booking, PublicBookingResult } from "@/types";

export const dynamic = "force-dynamic";

const STATUS_BY_CODE: Record<string, number> = {
  CREATED: 201,
  REPLAYED: 200,
  SLOT_TAKEN: 409,
  SLOT_CLOSED: 409,
  HOLIDAY: 409,
  PAST_SLOT: 409,
  OUT_OF_RANGE: 422,
  INVALID_SLOT: 422,
  INVALID_INPUT: 422,
  TOO_MANY_BOOKINGS: 429,
  IDEMPOTENCY_MISMATCH: 409,
};

/**
 * POST /api/bookings — create a booking.
 * 1. same-origin + rate limit
 * 2. server-side validation (never trusts the browser)
 * 3. LINE ID token verified with LINE; only verified id/name are stored
 * 4. atomic create_booking() in Postgres (advisory lock + unique index)
 * Idempotency key makes retries/double-clicks/refreshes safe.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("FORBIDDEN", 403);
  const ip = clientIp(req);
  if (!rateLimit(`book:${ip}`, 10, 60_000)) return fail("RATE_LIMITED", 429);

  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return fail("INVALID_INPUT", 400);
  }

  const v = validateBookingRequest(body);
  if (!v.ok) {
    const code = v.errors.consent ? "CONSENT_REQUIRED" : "INVALID_INPUT";
    return fail(code, 422, { errors: v.errors });
  }
  const input = v.value;

  // LINE: trust only what LINE says about the token
  let lineUserId: string | null = null;
  let lineDisplayName: string | null = null;
  if (input.lineIdToken) {
    const r = await verifyLineIdToken(input.lineIdToken);
    if (r.ok) {
      lineUserId = r.user.userId;
      lineDisplayName = r.user.displayName;
    } else if (r.reason === "INVALID") {
      return fail("LINE_TOKEN_INVALID", 401);
    }
    // NOT_CONFIGURED / UNREACHABLE: continue as a normal web booking
  }

  let supabase;
  try {
    supabase = createSupabaseAnonClient();
  } catch {
    return fail("SERVER_NOT_CONFIGURED", 503);
  }

  const { data, error } = await supabase.rpc("create_booking_public", {
    p_booking_date: input.date,
    p_start_time: input.startTime,
    p_username: input.username,
    p_phone_number: input.phone,
    p_service_type: input.serviceType,
    p_service_detail: input.serviceDetail,
    p_line_user_id: lineUserId,
    p_line_display_name: lineDisplayName,
    p_idempotency_key: input.idempotencyKey,
    p_server_token: BOOKING_SERVER_TOKEN,
  });

  if (error || !data) {
    console.error("create_booking failed", error?.message);
    return fail("SERVER_ERROR", 500, { detail: error?.message?.slice(0, 200) });
  }

  const result = data as { ok: boolean; code: string; booking?: Booking };
  const status = STATUS_BY_CODE[result.code] ?? (result.ok ? 200 : 400);
  if (!result.ok || !result.booking) return fail(result.code, status);

  const b = result.booking;
  const publicResult: PublicBookingResult = {
    bookingCode: b.booking_code,
    date: b.booking_date,
    start: b.start_time.slice(0, 5),
    end: b.end_time.slice(0, 5),
    username: b.username,
    phone: b.phone_number,
    serviceType: b.service_type,
    serviceDetail: b.service_detail,
  };
  return json({ ok: true, code: result.code, booking: publicResult }, status);
}
