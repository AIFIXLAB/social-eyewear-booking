import "server-only";
import { createSupabaseAnonClient } from "../supabase/service";
import { BOOKING_SERVER_TOKEN } from "../booking/serverToken.server";
import { DEFAULT_LIFF_ID, DEFAULT_LINE_LOGIN_CHANNEL_ID } from "./defaults";

export interface LineConfig {
  liffId: string;
  channelId: string; // LINE Login channel (verifies LIFF ID tokens)
  accessToken: string; // Messaging API (sends messages from the OA)
}

let cache: { at: number; value: LineConfig } | null = null;

/**
 * LINE settings: Vercel env vars win; otherwise the values the shop saved in
 * /admin/settings (stored privately in booking_settings). Cached 60 s.
 */
export async function getLineConfig(): Promise<LineConfig> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  let db: Record<string, unknown> = {};
  try {
    const { data } = await createSupabaseAnonClient().rpc("get_line_config", { p_token: BOOKING_SERVER_TOKEN });
    if (data && typeof data === "object") db = data as Record<string, unknown>;
  } catch {
    /* DB not reachable or migration 0003 not applied yet */
  }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const value: LineConfig = {
    liffId: process.env.NEXT_PUBLIC_LIFF_ID || str(db.liff_id) || DEFAULT_LIFF_ID,
    channelId: process.env.LINE_CHANNEL_ID || str(db.line_login_channel_id) || DEFAULT_LINE_LOGIN_CHANNEL_ID,
    accessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || str(db.line_channel_access_token),
  };
  cache = { at: Date.now(), value };
  return value;
}
