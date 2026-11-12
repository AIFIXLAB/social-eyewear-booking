import "server-only";
import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(code: string, status: number, extra: Record<string, unknown> = {}) {
  return json({ ok: false, code, ...extra }, status);
}

/** Parse a JSON body with a size cap (protects against huge payloads) */
export async function readJson(req: Request, maxBytes = 16_384): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("INVALID_JSON");
  }
}

/**
 * Best-effort in-memory rate limiter (per server instance).
 * On Vercel each instance has its own memory, so this throttles bursts
 * from a single client; the database rules remain the real guarantee.
 */
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

/** Reject cross-site POSTs to state-changing endpoints */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetches from some browsers omit it
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}
