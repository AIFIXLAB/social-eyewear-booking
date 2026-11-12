"use client";
import { useEffect, useRef } from "react";

/** Accessible modal built on <dialog> (works on iOS Safari 15.4+, Android, desktop, LINE in-app) */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={`w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl p-0 shadow-2xl backdrop:bg-black/40`}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิด"
              className="-mr-2 rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 px-5 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "ยืนยัน",
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-neutral-300 px-4 text-sm font-semibold">
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`min-h-11 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-700 hover:bg-brand-800"
            }`}
          >
            {loading ? "กำลังดำเนินการ..." : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-neutral-700">{message}</div>
    </Dialog>
  );
}
