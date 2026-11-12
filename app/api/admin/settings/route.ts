import { withAdmin } from "@/lib/auth/withAdmin";
import { json, fail, readJson } from "@/lib/http";
import { cleanText } from "@/lib/validation/booking";

export const dynamic = "force-dynamic";

/** Allowed keys and how to validate them */
const SCHEMA: Record<string, (v: unknown) => unknown | undefined> = {
  max_advance_days: (v) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 365 ? v : undefined),
  min_lead_minutes: (v) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 1440 ? v : undefined),
  max_active_bookings_per_phone: (v) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 50 ? v : undefined),
  announcement: (v) => (typeof v === "string" ? cleanText(v, 300) : undefined),
  shop_phone: (v) => (typeof v === "string" && /^[0-9+\-\s()]{0,20}$/.test(v) ? v.trim() : undefined),
};

export const GET = withAdmin(async (_req, { supabase }) => {
  const { data, error } = await supabase.from("booking_settings").select("setting_key, setting_value, description").order("setting_key");
  if (error) return fail("SERVER_ERROR", 500);
  return json({ ok: true, settings: data });
});

/** PATCH { key: value, ... } */
export const PATCH = withAdmin(async (req, { supabase }) => {
  let body: Record<string, unknown>;
  try {
    body = (await readJson(req)) as Record<string, unknown>;
  } catch {
    return fail("INVALID_INPUT", 400);
  }
  const updates: [string, unknown][] = [];
  for (const [k, v] of Object.entries(body ?? {})) {
    const check = SCHEMA[k];
    if (!check) return fail("INVALID_INPUT", 422, { field: k });
    const clean = check(v);
    if (clean === undefined) return fail("INVALID_INPUT", 422, { field: k });
    updates.push([k, clean]);
  }
  for (const [k, v] of updates) {
    const { error } = await supabase.from("booking_settings").update({ setting_value: v }).eq("setting_key", k);
    if (error) return fail("SERVER_ERROR", 500);
  }
  return json({ ok: true, updated: updates.map(([k]) => k) });
});
