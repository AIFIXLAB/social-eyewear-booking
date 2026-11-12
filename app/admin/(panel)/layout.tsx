import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) {
    // signed in but not an admin → sign out and explain
    try {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.auth.signOut();
        redirect("/admin/login?error=forbidden");
      }
    } catch (e) {
      if (e && typeof e === "object" && "digest" in e) throw e; // let redirect() through
    }
    redirect("/admin/login");
  }
  return <AdminShell email={admin.user.email ?? ""}>{children}</AdminShell>;
}
