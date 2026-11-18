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
export type PushResult = { ok: true } | { ok: false; reason: string; detail?: string };

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
    let detail = text.slice(0, 200);
    try {
      const j = JSON.parse(text) as { message?: string; details?: { message?: string }[] };
      detail = [j.message, ...(j.details ?? []).map((d) => d.message)].filter(Boolean).join(" · ");
    } catch {
      /* keep raw text */
    }
    return { ok: false, reason: `HTTP_${res.status}`, detail };
  } catch (e) {
    console.warn("LINE push error", e);
    return { ok: false, reason: "UNREACHABLE" };
  }
}

/** Thai explanation of a failed push, for the admin */
export function explainPushFailure(r: { reason: string; detail?: string }): string {
  const d = r.detail ? ` (${r.detail})` : "";
  switch (r.reason) {
    case "NOT_CONFIGURED":
      return "ยังไม่ได้ใส่ Channel access token ในหน้า ตั้งค่า";
    case "INVALID_TO":
      return "การจองนี้ไม่มี LINE ของลูกค้า (จองผ่านเว็บ)";
    case "HTTP_401":
      return "Channel access token ไม่ถูกต้องหรือถูก Reissue แล้ว — คัดลอก token ใหม่มาวางในหน้า ตั้งค่า" + d;
    case "HTTP_400":
      return "LINE ปฏิเสธข้อความ — ส่วนใหญ่เพราะลูกค้ายังไม่ได้แอดเพื่อน/บล็อก LINE OA หรือช่อง LINE Login กับ LINE OA อยู่คนละ Provider" + d;
    case "HTTP_403":
      return "token นี้ไม่มีสิทธิ์ส่งข้อความ (ใช้ token ของช่องผิด — ต้องเป็นของช่อง Messaging API)" + d;
    case "HTTP_429":
      return "ส่งข้อความครบโควตาของเดือนนี้แล้ว (แพ็กเกจฟรี 300 ข้อความ/เดือน)" + d;
    case "UNREACHABLE":
      return "เชื่อมต่อ LINE ไม่ได้ชั่วคราว ลองใหม่อีกครั้ง";
    default:
      return `ส่งไม่สำเร็จ: ${r.reason}${d}`;
  }
}

/** Check that the saved token works (LINE "get bot info") */
export async function checkLineToken(): Promise<{ ok: true; botName: string; basicId: string } | { ok: false; message: string }> {
  const token = (await getLineConfig()).accessToken;
  if (!token) return { ok: false, message: "ยังไม่ได้ใส่ Channel access token" };
  try {
    const res = await fetch("https://api.line.me/v2/bot/info", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, message: res.status === 401 ? "token ไม่ถูกต้อง (401) — คัดลอกใหม่จาก LINE Developers" : `LINE ตอบกลับ ${res.status}` };
    const j = (await res.json()) as { displayName?: string; basicId?: string };
    return { ok: true, botName: j.displayName ?? "", basicId: j.basicId ?? "" };
  } catch {
    return { ok: false, message: "เชื่อมต่อ LINE ไม่ได้" };
  }
}
