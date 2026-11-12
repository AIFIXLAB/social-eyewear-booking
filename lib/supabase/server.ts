import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicEnv } from "./env";

/**
 * Supabase client bound to the visitor's session cookies (anon key).
 * Used for admin pages/APIs — RLS + is_admin() apply to every query.
 */
export async function createSupabaseServerClient() {
  const env = supabasePublicEnv();
  if (!env) throw new Error("SERVER_NOT_CONFIGURED");
  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // called from a Server Component — middleware refreshes the session instead
        }
      },
    },
  });
}
