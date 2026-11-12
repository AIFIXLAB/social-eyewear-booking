import "server-only";
import { fail, sameOrigin } from "../http";
import { requireAdminApi, type AdminContext } from "./admin";

type Handler<P> = (req: Request, ctx: AdminContext, params: P) => Promise<Response>;

/**
 * Wraps an admin API route: same-origin check for writes, server-side
 * session + is_admin() check, and a safe 500 on unexpected errors.
 */
export function withAdmin<P = Record<string, never>>(handler: Handler<P>) {
  return async (req: Request, routeCtx: { params: Promise<P> }) => {
    if (req.method !== "GET" && !sameOrigin(req)) return fail("FORBIDDEN", 403);
    const auth = await requireAdminApi();
    if ("error" in auth) return fail(auth.error, auth.error === "UNAUTHORIZED" ? 401 : 403);
    try {
      const params = routeCtx?.params ? await routeCtx.params : ({} as P);
      return await handler(req, auth, params);
    } catch (e) {
      console.error("admin api error", e);
      return fail("SERVER_ERROR", 500);
    }
  };
}

/** Sanitise free-text search for PostgREST filter strings (keeps Thai letters + marks) */
export function sanitizeSearch(q: string | null): string {
  return (q ?? "").normalize("NFC").replace(/[^\p{L}\p{M}\p{N}\s-]/gu, "").trim().slice(0, 50);
}
