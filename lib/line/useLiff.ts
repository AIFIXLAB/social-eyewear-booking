"use client";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LIFF_ID } from "./defaults";

export type LiffState =
  | { status: "off" } // normal browser — booking works normally
  | { status: "loading" }
  | { status: "ready"; displayName: string; pictureUrl?: string }
  | { status: "error"; message: string; reason: string };

type Liff = typeof import("@line/liff").default;

function looksLikeLiffContext(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const q = window.location.search + window.location.hash;
  return /\bLine\//i.test(ua) || /liff\.state|liffClientId|liffRedirectUri|access_token|code=/.test(q);
}

/**
 * ONE LIFF initialisation per page load (module-level), so React re-renders,
 * StrictMode double effects or late-loading settings can never start a second,
 * conflicting liff.init().
 */
type InitResult =
  | { status: "off" }
  | { status: "redirecting" }
  | { status: "ready"; liff: Liff; displayName: string; pictureUrl?: string }
  | { status: "error"; reason: string };

let initPromise: Promise<InitResult> | null = null;
const RELOGIN_KEY = "se-liff-relogin";

function initOnce(liffId: string): Promise<InitResult> {
  if (initPromise) return initPromise;
  initPromise = (async (): Promise<InitResult> => {
    let liff: Liff;
    try {
      liff = (await import("@line/liff")).default;
    } catch (e) {
      return { status: "error", reason: `SDK_LOAD: ${String(e).slice(0, 120)}` };
    }
    try {
      await Promise.race([
        liff.init({ liffId, withLoginOnExternalBrowser: false }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 10s")), 10_000)),
      ]);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      return { status: "error", reason: `INIT: ${err.code ?? ""} ${err.message ?? String(e)}`.slice(0, 160) };
    }
    if (!liff.isLoggedIn()) {
      if (liff.isInClient()) {
        liff.login({ redirectUri: window.location.href });
        return { status: "redirecting" };
      }
      return { status: "off" }; // opened in a normal browser
    }
    try {
      const p = await liff.getProfile();
      try { sessionStorage.removeItem(RELOGIN_KEY); } catch { /* ignore */ }
      return { status: "ready", liff, displayName: p.displayName, pictureUrl: p.pictureUrl };
    } catch (e) {
      // The user consented earlier, before "profile" was added to the LIFF scopes.
      // Ask LINE for consent again — once per session, to avoid a redirect loop.
      let tried = false;
      try { tried = sessionStorage.getItem(RELOGIN_KEY) === "1"; } catch { /* ignore */ }
      if (!tried && /permission|scope/i.test(String(e))) {
        try { sessionStorage.setItem(RELOGIN_KEY, "1"); } catch { /* ignore */ }
        liff.logout();
        liff.login({ redirectUri: window.location.href });
        return { status: "redirecting" };
      }
      // Still no profile: the ID token (scope "openid") is enough to identify the
      // customer and send LINE messages; use its name claim if present.
      try {
        const decoded = liff.getDecodedIDToken();
        if (liff.getIDToken() && decoded?.sub) {
          return { status: "ready", liff, displayName: (decoded.name as string | undefined) ?? "", pictureUrl: decoded.picture as string | undefined };
        }
      } catch { /* fall through */ }
      return { status: "error", reason: `PROFILE: ${String(e).slice(0, 120)}` };
    }
  })();
  return initPromise;
}

let liffInstance: Liff | null = null;

/**
 * LINE LIFF integration. Any failure falls back to normal web booking and
 * reports a reason (shown in small text so problems can be diagnosed).
 * The browser never sends userId/displayName to our API — only the ID token,
 * which the server verifies with LINE.
 */
export function useLiff(liffIdFromSettings?: string) {
  const [state, setState] = useState<LiffState>({ status: "off" });
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || DEFAULT_LIFF_ID || liffIdFromSettings;

  useEffect(() => {
    // Always try LIFF when configured: liff.init() is harmless in a normal browser
    // (isLoggedIn() is false there → we fall back to web booking), and it avoids
    // guessing the LINE in-app browser from the user agent.
    if (!liffId) return;
    let alive = true;
    setState({ status: "loading" });
    initOnce(liffId).then((r) => {
      if (!alive) return;
      if (r.status === "ready") {
        liffInstance = r.liff;
        setState({ status: "ready", displayName: r.displayName, pictureUrl: r.pictureUrl });
      } else if (r.status === "error" && !looksLikeLiffContext()) {
        console.warn("LIFF not available in this browser", r.reason);
        setState({ status: "off" }); // normal web visitor: no warning needed
      } else if (r.status === "error") {
        console.warn("LIFF failed", r.reason);
        setState({ status: "error", reason: r.reason, message: "เชื่อมต่อ LINE ไม่สำเร็จ ยังจองได้โดยกรอกชื่อเอง" });
      } else if (r.status === "off") {
        setState({ status: "off" });
      }
      // "redirecting": keep loading state while LINE login takes over
    });
    return () => {
      alive = false;
    };
  }, [liffId]);

  /** Fresh ID token for the server to verify (null if not available) */
  const getIdToken = useCallback((): string | null => {
    try {
      return liffInstance?.getIDToken() ?? null;
    } catch {
      return null;
    }
  }, []);

  const relogin = useCallback(() => {
    const liff = liffInstance;
    if (!liff) return;
    try {
      liff.logout();
      liff.login({ redirectUri: window.location.href });
    } catch {
      /* ignore */
    }
  }, []);

  return { state, getIdToken, relogin };
}
