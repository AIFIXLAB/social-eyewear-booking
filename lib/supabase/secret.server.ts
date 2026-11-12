import "server-only";
/**
 * SERVER ONLY secret key. "server-only" makes the build fail if this file
 * is ever imported into browser code. Keep the GitHub repository PRIVATE.
 * If this key is ever exposed, roll it in Supabase → Project Settings → API Keys
 * and set the new one as SUPABASE_SERVICE_ROLE_KEY in Vercel.
 */
export const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_rhgVOL0bh4MAotc78sG50w_PJRiw9hi";
