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
  liff_id: (v) => (typeof v === "string" && /^(\d{10}-[A-Za-z0-9]{8})?$/.test(v.trim()) ? v.trim() : undefined),
  line_login_channel_id: (v) => (typeof v === "string" && /^(\d{10})?$/.test(v.trim()) ? v.trim() : undefined),
  line_channel_access_token: (v) => (typeof v === "string" && v.trim().length <= 400 && !/\s/.test(v.trim()) ? v.trim() : undefined),
};

const SECRET_KEYS = new Set(["line_channel_access_token"]);
const MASK = "••••••••";

export const GET = withAdmin(async (_req, { supabase }) => {
  const { data, error } = await supabase.from("booking_settings").select("setting_key, setting_value, description").order("setting_key");
  if (error) return fail("SERVER_ERROR", 500);
  const settings = (data ?? [])
    .filter((r) => r.setting_key !== "server_token")
    .map((r) =>
      SECRET_KEYS.has(r.setting_key) && typeof r.setting_value === "string" && r.setting_value
        ? { ...r, setting_value: MASK + r.setting_value.slice(-4) }
        : r,
    );
  return json({ ok: true, settings });
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
    if (SECRET_KEYS.has(k) && typeof v === "string" && v.startsWith(MASK)) continue; // unchanged
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
