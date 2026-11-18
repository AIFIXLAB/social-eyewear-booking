import "server-only";
import { getLineConfig } from "./config.server";

/**
 * Send LINE push messages through the Messaging API of the shop's
 * LINE Official Account. Needs LINE_CHANNEL_ACCESS_TOKEN (long-lived token
 * from LINE Developers → Messaging API channel → Messaging API tab).
 *
 * Never throws: a failed LINE message must never break a booking.
 * Note: the customer must have added the OA as a friend, and the LIFF
 * (LINE Login) channel must be under the SAME provider as the OA,
 * otherwise LINE user ids don't match and pushes are rejected.
 */
export type PushResult = { ok: true } | { ok: false; reason: string };

export async function lineMessagingConfigured(): Promise<boolean> {
  return !!(await getLineConfig()).accessToken;
}

export async function pushLine(to: string, messages: object[], retryKey?: string): Promise<PushResult> {
  const token = (await getLineConfig()).accessToken;
  if (!token) return { ok: false, reason: "NOT_CONFIGURED" };
  if (!/^[UCR][0-9a-f]{32}$/.test(to)) return { ok: false, reason: "INVALID_TO" };
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        // LINE de-duplicates retries with the same key (must be a UUID)
        ...(retryKey ? { "X-Line-Retry-Key": retryKey } : {}),
      },
      body: JSON.stringify({ to, messages }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok || res.status === 409) return { ok: true }; // 409 = already sent with this retry key
    const text = await res.text().catch(() => "");
    console.warn("LINE push failed", res.status, text.slice(0, 300));
    return { ok: false, reason: `HTTP_${res.status}` };
  } catch (e) {
    console.warn("LINE push error", e);
    return { ok: false, reason: "UNREACHABLE" };
  }
}
