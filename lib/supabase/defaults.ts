/**
 * Public Supabase connection values (safe for the browser).
 * Environment variables, when set (e.g. in Vercel), take priority.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jjjotlpmeqazdacjbkmt.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_GmTSZxPBRW6KpiL4x9ubWA_PTIMAGfQ";
