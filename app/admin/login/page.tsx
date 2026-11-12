"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/EmptyState";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(sp.get("error") === "forbidden" ? "บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ" : null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        return;
      }
      const next = sp.get("next");
      router.replace(next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
      router.refresh();
    } catch {
      setError("ระบบยังไม่ได้ตั้งค่า Supabase หรือเชื่อมต่อไม่ได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4 p-6" noValidate>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="h-10 w-10 rounded-lg" />
        <div>
          <p className="text-xs font-semibold text-brand-700">Social Eyewear</p>
          <h1 className="text-lg font-bold">เข้าสู่ระบบผู้ดูแล</h1>
        </div>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <div>
        <label htmlFor="email" className="label">อีเมล</label>
        <input id="email" type="email" autoComplete="username" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor="password" className="label">รหัสผ่าน</label>
        <input id="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!email || !password}>
        เข้าสู่ระบบ
      </Button>
      <p className="text-center text-xs text-neutral-500">ไม่มีการสมัครสมาชิกสำหรับผู้ดูแล — ติดต่อผู้ดูแลที่มีอยู่เพื่อเพิ่มบัญชี</p>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
