export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function LoadingBlock({ label = "กำลังโหลด..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-neutral-500" role="status">
      <Spinner className="h-5 w-5 text-brand-700" />
      {label}
    </div>
  );
}
