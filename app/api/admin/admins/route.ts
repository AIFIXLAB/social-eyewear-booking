import { withAdmin } from "@/lib/auth/withAdmin";
import { json, fail, readJson } from "@/lib/http";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isUuid } from "@/lib/validation/booking";

export const dynamic = "force-dynamic";

/** GET — list admin accounts (all admins have equal rights) */
export const GET = withAdmin(async (_req, { supabase, user }) => {
  const { data, error } = await supabase.from("admins").select("id, email, created_at").order("created_at");
  if (error) return fail("SERVER_ERROR", 500);
  return json({ ok: true, admins: data, me: user.id });
});

/**
 * POST {email, password} — an existing admin adds a new admin.
 * Public sign-up stays disabled; accounts are created server-side with the
 * service role, and only become admins by being inserted into public.admins.
 */
export const POST = withAdmin(async (req) => {
  let b: Record<string, unknown>;
  try {
    b = (await readJson(req)) as Record<string, unknown>;
  } catch {
    return fail("INVALID_INPUT", 400);
  }
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return fail("INVALID_INPUT", 422, { field: "email" });
  if (password.length < 10 || password.length > 72) return fail("INVALID_INPUT", 422, { field: "password" });

  const svc = createSupabaseServiceClient();
  const created = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  let userId = created.data.user?.id;
  if (created.error) {
    // user may already exist in Auth (e.g. previously removed admin) → look it up
    const list = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list.data?.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!userId) return fail("INVALID_INPUT", 422, { message: created.error.message });
  }
  const { error } = await svc.from("admins").upsert({ id: userId, email }, { onConflict: "id" });
  if (error) return fail("SERVER_ERROR", 500);
  return json({ ok: true, id: userId }, 201);
});

/** DELETE ?id= — revoke admin rights (cannot remove yourself or the last admin) */
export const DELETE = withAdmin(async (req, { user }) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!isUuid(id)) return fail("INVALID_INPUT", 400);
  if (id === user.id) return fail("CANNOT_REMOVE_SELF", 409);
  const svc = createSupabaseServiceClient();
  const { count } = await svc.from("admins").select("id", { count: "exact", head: true });
  if ((count ?? 0) <= 1) return fail("LAST_ADMIN", 409);
  const { error } = await svc.from("admins").delete().eq("id", id);
  if (error) return fail("SERVER_ERROR", 500);
  return json({ ok: true });
});
