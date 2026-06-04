"use client";

import { useEffect } from "react";
import { Loader2, X } from "lucide-react";

type ConfirmationModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  tone?: "danger" | "neutral";
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  tone = "neutral",
  onCancel,
  onConfirm
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  if (!open) return null;

  const confirmClass =
    tone === "danger"
      ? "border-rose-300/30 bg-rose-300/[0.12] text-rose-100 hover:bg-rose-300/[0.18]"
      : "border-teal-300/30 bg-teal-300/[0.12] text-teal-100 hover:bg-teal-300/[0.18]";

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        className="flex min-h-[100dvh] w-full flex-col justify-between border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xl sm:min-h-0 sm:max-w-md sm:rounded-[8px]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="confirmation-modal-title" className="text-lg font-semibold text-white">
              {title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">{description}</p>
          </div>
          <button
            type="button"
            aria-label={cancelLabel}
            onClick={onCancel}
            disabled={loading}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-[6px] border border-[var(--line)] bg-white/[0.03] px-4 text-sm font-medium text-[var(--muted-2)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
