"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type LiffState =
  | { status: "off" } // normal browser / LIFF not configured — booking works normally
  | { status: "loading" }
  | { status: "ready"; displayName: string; pictureUrl?: string }
  | { status: "error"; message: string };

type Liff = typeof import("@line/liff").default;

function looksLikeLiffContext(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const q = window.location.search + window.location.hash;
  return /\bLine\//i.test(ua) || /liff\.state|liffClientId|liffRedirectUri/.test(q);
}

/**
 * LINE LIFF integration.
 * - Only loads the SDK when opened from LINE (or returning from LINE login),
 *   so normal browsers are never slowed down or blocked.
 * - Any failure falls back to normal web booking (status "off"/"error").
 * - The browser NEVER sends userId/displayName to our API — only the ID
 *   token, which the server verifies with LINE.
 */
export function useLiff() {
  const [state, setState] = useState<LiffState>({ status: "off" });
  const liffRef = useRef<Liff | null>(null);

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId || !looksLikeLiffContext()) return;
    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await Promise.race([
          liff.init({ liffId, withLoginOnExternalBrowser: false }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("LIFF init timeout")), 8000)),
        ]);
        if (cancelled) return;
        liffRef.current = liff;

        if (!liff.isLoggedIn()) {
          if (liff.isInClient()) {
            liff.login({ redirectUri: window.location.href });
            return;
          }
          setState({ status: "off" });
          return;
        }
        const profile = await liff.getProfile();
        if (cancelled) return;
        setState({ status: "ready", displayName: profile.displayName, pictureUrl: profile.pictureUrl });
      } catch (e) {
        console.warn("LIFF unavailable, falling back to web booking", e);
        if (!cancelled) setState({ status: "error", message: "ไม่สามารถเชื่อมต่อ LINE ได้ สามารถจองโดยกรอกชื่อเองได้" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Fresh ID token for the server to verify (null if not available) */
  const getIdToken = useCallback((): string | null => {
    try {
      return liffRef.current?.getIDToken() ?? null;
    } catch {
      return null;
    }
  }, []);

  const relogin = useCallback(() => {
    const liff = liffRef.current;
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
