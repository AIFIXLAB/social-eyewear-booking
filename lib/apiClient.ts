"use client";

export interface ApiResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  code: string;
  data: T & { ok?: boolean; code?: string };
}

/** Small fetch wrapper for admin pages: JSON in/out, timeout, 401 → login */
export async function api<T = Record<string, unknown>>(
  path: string,
  init: { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 20_000);
  try {
    const res = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    let data = {} as ApiResult<T>["data"];
    try {
      data = await res.json();
    } catch {
      /* empty */
    }
    if (res.status === 401 && typeof window !== "undefined" && path.startsWith("/api/admin")) {
      window.location.href = `/admin/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    return { ok: res.ok && data.ok !== false, status: res.status, code: data.code ?? (res.ok ? "OK" : "SERVER_ERROR"), data };
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    return { ok: false, status: 0, code: aborted ? "TIMEOUT" : "NETWORK_ERROR", data: {} as ApiResult<T>["data"] };
  } finally {
    clearTimeout(timer);
  }
}
