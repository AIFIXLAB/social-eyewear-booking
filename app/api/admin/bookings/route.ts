import { withAdmin, sanitizeSearch } from "@/lib/auth/withAdmin";
import { json, fail, readJson } from "@/lib/http";
import { isYm, isYmd, monthRange } from "@/lib/booking/dates";
import { SERVICE_VALUES, STATUS_VALUES, validateBookingRequest } from "@/lib/validation/booking";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/bookings?q=&date=&month=&service=&status=&page=1&pageSize=50&sort=created|appointment
 * Reads through the admin's own session → RLS applies.
 */
export const GET = withAdmin(async (req, { supabase }) => {
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(200, Math.max(10, Number(sp.get("pageSize")) || 50));
  const sort = sp.get("sort") === "created" ? "created" : "appointment";

  let query = supabase.from("bookings").select("*", { count: "exact" });

  const q = sanitizeSearch(sp.get("q"));
  if (q) {
    const digits = q.replace(/\D/g, "");
    const parts = [`username.ilike.%${q}%`, `line_display_name.ilike.%${q}%`, `booking_code.ilike.%${q.toUpperCase()}%`];
    if (digits.length >= 3) parts.push(`phone_number.ilike.%${digits}%`);
    query = query.or(parts.join(","));
  }
  const date = sp.get("date");
  const month = sp.get("month");
  if (date && isYmd(date)) query = query.eq("booking_date", date);
  else if (month && isYm(month)) {
    const r = monthRange(month);
    query = query.gte("booking_date", r.from).lte("booking_date", r.to);
  }
  const from = sp.get("from");
  const to = sp.get("to");
  if (isYmd(from)) query = query.gte("booking_date", from);
  if (isYmd(to)) query = query.lte("booking_date", to);

  const service = sp.get("service");
  if (service && (SERVICE_VALUES as string[]).includes(service)) query = query.eq("service_type", service);
  const status = sp.get("status");
  if (status && (STATUS_VALUES as string[]).includes(status)) query = query.eq("booking_status", status);

  query =
    sort === "created"
      ? query.order("created_at", { ascending: false })
      : query.order("booking_date", { ascending: false }).order("start_time", { ascending: true });

  const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) {
    console.error(error.message);
    return fail("SERVER_ERROR", 500);
  }
  return json({ ok: true, bookings: data, total: count ?? 0, page, pageSize });
});

/**
 * POST /api/admin/bookings — admin adds a booking on behalf of a customer
 * (phone / walk-in). Goes through the same atomic create_booking().
 */
export const POST = withAdmin(async (req) => {
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return fail("INVALID_INPUT", 400);
  }
  const v = validateBookingRequest({ ...(body as object), consent: true, lineIdToken: null, website: "" });
  if (!v.ok) return fail("INVALID_INPUT", 422, { errors: v.errors });
  const i = v.value;
  const { data, error } = await createSupabaseServiceClient().rpc("create_booking", {
    p_booking_date: i.date,
    p_start_time: i.startTime,
    p_username: i.username,
    p_phone_number: i.phone,
    p_service_type: i.serviceType,
    p_service_detail: i.serviceDetail,
    p_line_user_id: null,
    p_line_display_name: null,
    p_idempotency_key: i.idempotencyKey,
  });
  if (error || !data) return fail("SERVER_ERROR", 500);
  const r = data as { ok: boolean; code: string; booking?: unknown };
  return r.ok ? json(r, 201) : fail(r.code, 409);
});
