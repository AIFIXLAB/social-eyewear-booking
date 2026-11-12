import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicEnv } from "./env";
import { SUPABASE_SECRET_KEY } from "./secret.server";

let cached: SupabaseClient | null = null;

/**
 * Service-role client. SERVER ONLY (the "server-only" import makes the
 * build fail if this file is ever imported into client code).
 * Used for: create_booking RPC (after server validation + LINE token
 * verification) and for creating admin accounts.
 */
export function createSupabaseServiceClient(): SupabaseClient {
  if (cached) return cached;
  const env = supabasePublicEnv();
  const key = SUPABASE_SECRET_KEY;
  if (!env || !key) throw new Error("SERVER_NOT_CONFIGURED");
  cached = createClient(env.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** Anonymous client for public, non-personal reads (availability) */
export function createSupabaseAnonClient(): SupabaseClient {
  const env = supabasePublicEnv();
  if (!env) throw new Error("SERVER_NOT_CONFIGURED");
  return createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
