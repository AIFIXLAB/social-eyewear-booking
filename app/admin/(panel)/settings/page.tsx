"use client";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { LoadingBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/apiClient";
import { errorMessage } from "@/lib/booking/constants";
import { formatThaiDateTime } from "@/lib/booking/dates";

interface Setting { setting_key: string; setting_value: unknown; description: string | null }
interface AdminRow { id: string; email: string; created_at: string }

const FIELDS: { key: string; label: string; type: "number" | "text"; help?: string }[] = [
  { key: "max_advance_days", label: "จองล่วงหน้าได้สูงสุด (วัน)", type: "number" },
  { key: "min_lead_minutes", label: "ต้องจองก่อนเวลาเริ่มรอบอย่างน้อย (นาที)", type: "number", help: "0 = จองได้จนถึงเวลาเริ่มรอบ" },
  { key: "max_active_bookings_per_phone", label: "จำนวนนัดที่ยังไม่ถึงกำหนดสูงสุดต่อเบอร์โทร", type: "number", help: "ป้องกันการจองสแปม" },
  { key: "shop_phone", label: "เบอร์โทรร้าน (แสดงในหน้ายืนยันการจอง)", type: "text" },
  { key: "announcement", label: "ข้อความประกาศบนหน้าจอง", type: "text", help: "เว้นว่างเพื่อซ่อน" },
];

const ADMIN_ERRORS: Record<string, string> = {
  CANNOT_REMOVE_SELF: "ไม่สามารถลบสิทธิ์ของบัญชีตัวเองได้",
  LAST_ADMIN: "ต้องมีผู้ดูแลอย่างน้อย 1 บัญชี",
};

export default function SettingsPage() {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [me, setMe] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<AdminRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, a] = await Promise.all([
      api<{ settings: Setting[] }>("/api/admin/settings"),
      api<{ admins: AdminRow[]; me: string }>("/api/admin/admins"),
    ]);
    setLoading(false);
    if (s.ok) setValues(Object.fromEntries(s.data.settings.map((x) => [x.setting_key, String(x.setting_value ?? "")])));
    if (a.ok) {
      setAdmins(a.data.admins);
      setMe(a.data.me);
    }
    if (!s.ok || !a.ok) toast.error(errorMessage(s.ok ? a.code : s.code));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    for (const f of FIELDS) body[f.key] = f.type === "number" ? Number(values[f.key]) : values[f.key] ?? "";
    setSaving(true);
    const r = await api("/api/admin/settings", { method: "PATCH", body });
    setSaving(false);
    if (!r.ok) return toast.error(`บันทึกไม่สำเร็จ: ค่าไม่ถูกต้อง (${String((r.data as { field?: string }).field ?? "")})`);
    toast.success("บันทึกการตั้งค่าแล้ว");
  }

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    const r = await api("/api/admin/admins", { method: "POST", body: { email: newEmail, password: newPass } });
    setAdding(false);
    if (!r.ok) {
      const f = (r.data as { field?: string }).field;
      return toast.error(f === "password" ? "รหัสผ่านต้องยาว 10–72 ตัวอักษร" : f === "email" ? "อีเมลไม่ถูกต้อง" : errorMessage(r.code));
    }
    toast.success(`เพิ่มผู้ดูแล ${newEmail} แล้ว`);
    setNewEmail("");
    setNewPass("");
    load();
  }

  async function removeAdmin() {
    if (!removing) return;
    setAdding(true);
    const r = await api(`/api/admin/admins?id=${removing.id}`, { method: "DELETE" });
    setAdding(false);
    if (!r.ok) return toast.error(ADMIN_ERRORS[r.code] ?? errorMessage(r.code));
    toast.success("ถอนสิทธิ์ผู้ดูแลแล้ว");
    setRemoving(null);
    load();
  }

  if (loading) return <LoadingBlock />;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="การตั้งค่าระบบจองและบัญชีผู้ดูแล" />

      <form onSubmit={saveSettings} className="card space-y-4 p-5">
        <h2 className="font-semibold">การตั้งค่าการจอง</h2>
        <p className="text-sm text-neutral-500">รอบตรวจมาตรฐาน: 9 รอบต่อวัน (11:00–20:00) รอบละ 1 ชั่วโมง รับลูกค้า 1 ท่านต่อรอบ</p>
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label" htmlFor={f.key}>{f.label}</label>
            <input
              id={f.key}
              type={f.type}
              inputMode={f.type === "number" ? "numeric" : undefined}
              className="input"
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
            {f.help && <p className="mt-1 text-xs text-neutral-500">{f.help}</p>}
          </div>
        ))}
        <Button type="submit" loading={saving}>บันทึกการตั้งค่า</Button>
      </form>

      <section className="card mt-6 p-5">
        <h2 className="font-semibold">บัญชีผู้ดูแลระบบ</h2>
        <p className="mb-3 text-sm text-neutral-500">ทุกบัญชีมีสิทธิ์เท่ากัน และจัดการระบบได้ทั้งหมด</p>
        <ul className="divide-y divide-neutral-100">
          {admins.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{a.email} {a.id === me && <span className="text-xs text-brand-700">(คุณ)</span>}</p>
                <p className="text-xs text-neutral-500">เพิ่มเมื่อ {formatThaiDateTime(a.created_at)}</p>
              </div>
              {a.id !== me && <Button size="sm" variant="secondary" onClick={() => setRemoving(a)}>ถอนสิทธิ์</Button>}
            </li>
          ))}
        </ul>

        <form onSubmit={addAdmin} className="mt-4 grid gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="na-email">อีเมลผู้ดูแลใหม่</label>
            <input id="na-email" type="email" className="input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required autoComplete="off" />
          </div>
          <div>
            <label className="label" htmlFor="na-pass">รหัสผ่านเริ่มต้น (10+ ตัว)</label>
            <input id="na-pass" type="password" className="input" value={newPass} onChange={(e) => setNewPass(e.target.value)} required minLength={10} autoComplete="new-password" />
          </div>
          <Button type="submit" size="lg" loading={adding}>เพิ่มผู้ดูแล</Button>
        </form>
        <p className="mt-2 text-xs text-neutral-500">แจ้งรหัสผ่านให้ผู้ดูแลใหม่ผ่านช่องทางที่ปลอดภัย</p>
      </section>

      <ConfirmDialog
        open={!!removing}
        title="ถอนสิทธิ์ผู้ดูแล"
        danger
        loading={adding}
        confirmLabel="ถอนสิทธิ์"
        message={removing && <>ถอนสิทธิ์ผู้ดูแลของ <strong>{removing.email}</strong>? บัญชีนี้จะเข้าหน้า Admin ไม่ได้อีก</>}
        onConfirm={removeAdmin}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
