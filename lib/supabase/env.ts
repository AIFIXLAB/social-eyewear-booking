import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./defaults";

export function supabasePublicEnv(): { url: string; anonKey: string } | null {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || SUPABASE_URL.includes("YOUR-PROJECT-REF")) return null;
  return { url: SUPABASE_URL, anonKey: SUPABASE_PUBLISHABLE_KEY };
}
