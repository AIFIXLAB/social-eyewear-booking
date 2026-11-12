import "server-only";

export interface VerifiedLineUser {
  userId: string; // "U" + 32 hex
  displayName: string | null;
}

export type LineVerifyResult =
  | { ok: true; user: VerifiedLineUser }
  | { ok: false; reason: "NOT_CONFIGURED" | "INVALID" | "UNREACHABLE" };

/**
 * Verify a LIFF ID token with LINE's official endpoint.
 * We never trust a userId/displayName sent by the browser; we only
 * trust what LINE returns for a token issued to OUR channel.
 * Docs: https://developers.line.biz/en/reference/line-login/#verify-id-token
 */
export async function verifyLineIdToken(idToken: string): Promise<LineVerifyResult> {
  const channelId = process.env.LINE_CHANNEL_ID;
  if (!channelId) return { ok: false, reason: "NOT_CONFIGURED" };

  let res: Response;
  try {
    res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return { ok: false, reason: "UNREACHABLE" };
  }
  if (!res.ok) return { ok: false, reason: "INVALID" };

  const data = (await res.json()) as { sub?: string; name?: string; aud?: string; exp?: number };
  if (!data.sub || !/^U[0-9a-f]{32}$/.test(data.sub)) return { ok: false, reason: "INVALID" };
  if (data.aud && data.aud !== channelId) return { ok: false, reason: "INVALID" };
  if (data.exp && data.exp * 1000 < Date.now()) return { ok: false, reason: "INVALID" };

  return {
    ok: true,
    user: { userId: data.sub, displayName: data.name ? data.name.slice(0, 200) : null },
  };
}
