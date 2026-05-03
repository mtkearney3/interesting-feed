"use client";

import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";

type Props = {
  captureId: string;
  /** Called after a successful delete (e.g. close detail modal). */
  onDeleted?: () => void;
};

export function DeleteCaptureButton({ captureId, onDeleted }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (!window.confirm("Delete this clip?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/captures/${captureId}`, {
        method: "DELETE",
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        window.alert(body.error ?? `Delete failed (${res.status})`);
        return;
      }
      router.refresh();
      onDeleted?.();
    } catch {
      window.alert("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-red-500 transition hover:bg-red-50 active:scale-95 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
      aria-label="Delete clip"
    >
      <svg
        className="h-3.5 w-3.5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
      </svg>
      Delete
    </button>
  );
}
