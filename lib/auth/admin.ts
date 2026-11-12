import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "../supabase/server";

export type AdminContext = { supabase: SupabaseClient; user: User };

/**
 * Server-side admin check. Verifies the session with Supabase Auth
 * (getUser hits the Auth server — it does not trust the cookie alone)
 * and confirms the user exists in public.admins via is_admin().
 * RLS enforces the same rule again inside the database.
 */
export async function getAdmin(): Promise<AdminContext | null> {
  let supabase: SupabaseClient;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return null;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || isAdmin !== true) return null;
  return { supabase, user };
}

/** For API route handlers: returns ctx or a ready-made error response code */
export async function requireAdminApi(): Promise<AdminContext | { error: "UNAUTHORIZED" | "FORBIDDEN" }> {
  let supabase: SupabaseClient;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return { error: "UNAUTHORIZED" };
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "UNAUTHORIZED" };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) return { error: "FORBIDDEN" };
  return { supabase, user };
}
