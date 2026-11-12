"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const NAV = [
  { href: "/admin", label: "Dashboard", th: "ภาพรวม" },
  { href: "/admin/bookings", label: "Booking Management", th: "รายการจอง" },
  { href: "/admin/calendar", label: "Calendar Management", th: "ปฏิทิน" },
  { href: "/admin/holidays", label: "Holiday Management", th: "วันหยุด" },
  { href: "/admin/slots", label: "Slot Management", th: "เปิด/ปิดรอบ" },
  { href: "/admin/reports", label: "Reports & Export", th: "รายงาน" },
  { href: "/admin/settings", label: "Settings", th: "ตั้งค่า" },
];

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className="min-h-dvh bg-neutral-50 lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="no-print hidden w-64 shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="h-9 w-9 rounded-lg" />
          <div>
            <p className="text-sm font-bold text-brand-800">Social Eyewear</p>
            <p className="text-xs text-neutral-500">Booking Admin</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-col rounded-xl px-3 py-2.5 text-sm ${
                isActive(n.href) ? "bg-brand-700 text-white" : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              <span className="font-semibold">{n.th}</span>
              <span className={`text-[11px] ${isActive(n.href) ? "text-white/70" : "text-neutral-400"}`}>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="border-t border-neutral-100 p-4">
          <p className="mb-2 truncate text-xs text-neutral-500" title={email}>{email}</p>
          <button onClick={logout} disabled={loggingOut} className="w-full rounded-xl border border-neutral-300 py-2.5 text-sm font-semibold hover:bg-neutral-50">
            {loggingOut ? "กำลังออก..." : "ออกจากระบบ (Logout)"}
          </button>
        </div>
      </aside>

      {/* Top bar (mobile/tablet) */}
      <div className="no-print sticky top-0 z-30 border-b border-neutral-200 bg-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="h-8 w-8 rounded-lg" />
            <span className="text-sm font-bold text-brand-800">Social Eyewear Admin</span>
          </div>
          <button onClick={logout} disabled={loggingOut} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-neutral-600">
            ออกจากระบบ
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium ${
                isActive(n.href) ? "bg-brand-700 text-white" : "bg-neutral-100 text-neutral-700"
              }`}
            >
              {n.th}
            </Link>
          ))}
        </nav>
      </div>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
