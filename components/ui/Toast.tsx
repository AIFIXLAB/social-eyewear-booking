"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastKind = "success" | "error" | "info";
interface ToastItem { id: number; kind: ToastKind; message: string }

const ToastCtx = createContext<(kind: ToastKind, message: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setItems((xs) => [...xs.slice(-2), { id, kind, message }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);

  const styles: Record<ToastKind, string> = {
    success: "bg-brand-700 text-white",
    error: "bg-red-600 text-white",
    info: "bg-neutral-900 text-white",
  };

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 no-print"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto w-full max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${styles[t.kind]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastCtx);
  return {
    success: (m: string) => push("success", m),
    error: (m: string) => push("error", m),
    info: (m: string) => push("info", m),
  };
}
