import "server-only";
/**
 * Optional Supabase secret key (only needed for "add admin" in Settings).
 * Set SUPABASE_SERVICE_ROLE_KEY in Vercel if you want that feature;
 * otherwise add admins from the Supabase dashboard.
 */
export const SUPABASE_SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
