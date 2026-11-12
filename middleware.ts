import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase/defaults";

/**
 * Refreshes the Supabase session cookie for admin routes and bounces
 * signed-out visitors to /admin/login. This is a convenience layer —
 * every admin page and API ALSO checks is_admin() on the server, and
 * RLS checks it again in the database.
 */
export async function middleware(request: NextRequest) {
  const url = SUPABASE_URL;
  const key = SUPABASE_PUBLISHABLE_KEY;
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/admin/login";
  const isApi = pathname.startsWith("/api/");

  if (!url || !key) {
    if (isLogin || isApi) return NextResponse.next();
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !isLogin && !isApi) {
    const to = new URL("/admin/login", request.url);
    to.searchParams.set("next", pathname);
    return NextResponse.redirect(to);
  }
  if (!user && isApi) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
