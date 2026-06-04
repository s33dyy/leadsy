"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";

type ToastInput = {
  title: string;
  detail?: string;
  tone?: ToastTone;
};

type Toast = ToastInput & {
  id: string;
  tone: ToastTone;
};

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, { icon: typeof CheckCircle2; className: string }> = {
  success: { icon: CheckCircle2, className: "border-teal-300/25 bg-teal-300/10 text-teal-100" },
  error: { icon: CircleAlert, className: "border-rose-300/25 bg-rose-300/10 text-rose-100" },
  info: { icon: Info, className: "border-sky-300/25 bg-sky-300/10 text-sky-100" }
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      const nextToast: Toast = {
        id,
        title: input.title,
        detail: input.detail,
        tone: input.tone ?? "info"
      };
      setToasts((current) => [nextToast, ...current].slice(0, 4));
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div data-testid="toast-viewport" className="fixed right-4 top-20 z-[70] w-[min(380px,calc(100vw-2rem))] space-y-2">
        {toasts.map((item) => {
          const style = toneStyles[item.tone];
          const Icon = style.icon;
          return (
            <div key={item.id} role="status" className={`rounded-[8px] border p-3 shadow-2xl backdrop-blur-xl ${style.className}`}>
              <div className="flex items-start gap-3">
                <Icon size={17} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{item.title}</div>
                  {item.detail ? <div className="mt-1 text-xs leading-5 opacity-90">{item.detail}</div> : null}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(item.id)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-[6px] hover:bg-white/10"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return value;
}
