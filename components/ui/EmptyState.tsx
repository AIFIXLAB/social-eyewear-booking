export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-xl text-neutral-400" aria-hidden>
        ○
      </div>
      <p className="font-semibold text-neutral-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ kind = "info", children }: { kind?: "info" | "warning" | "error" | "success"; children: React.ReactNode }) {
  const map = {
    info: "border-neutral-200 bg-neutral-50 text-neutral-700",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-brand-200 bg-brand-50 text-brand-800",
  } as const;
  return (
    <div role={kind === "error" ? "alert" : undefined} className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${map[kind]}`}>
      {children}
    </div>
  );
}
