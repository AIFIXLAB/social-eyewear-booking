#!/usr/bin/env node
/**
 * Create (or promote) an admin account.
 *
 *   node --env-file=.env.local scripts/create-admin.mjs owner@example.com 'StrongPassword123'
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY — run it on your own computer, never in the browser.
 * After the first admin exists, more admins can be added from /admin/settings.
 */
import { createClient } from "@supabase/supabase-js";

const [, , email, password] = process.argv;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jjjotlpmeqazdacjbkmt.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("✗ Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. node --env-file=.env.local ...)");
  process.exit(1);
}
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: node scripts/create-admin.mjs <email> <password>");
  process.exit(1);
}
if (!password || password.length < 10) {
  console.error("✗ Password must be at least 10 characters");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const normalized = email.trim().toLowerCase();

let userId;
const created = await supabase.auth.admin.createUser({ email: normalized, password, email_confirm: true });
if (created.error) {
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  userId = data?.users.find((u) => u.email?.toLowerCase() === normalized)?.id;
  if (!userId) {
    console.error("✗ Could not create user:", created.error.message);
    process.exit(1);
  }
  console.log("• User already exists in Auth — promoting to admin (password unchanged)");
} else {
  userId = created.data.user.id;
  console.log("• Auth user created");
}

const { error } = await supabase.from("admins").upsert({ id: userId, email: normalized }, { onConflict: "id" });
if (error) {
  console.error("✗ Could not insert into admins:", error.message);
  process.exit(1);
}
console.log(`✓ ${normalized} is now an admin. Sign in at /admin/login`);
