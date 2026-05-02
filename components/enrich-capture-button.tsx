"use client";

import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";

type Props = {
  captureId: string;
  status: string | null;
};

const retryButtonClass =
  "inline-flex items-center justify-center rounded-full px-4 py-1.5 text-sm font-medium text-[#2f3e2f] bg-[#2f3e2f]/10 transition hover:bg-[#2f3e2f]/15 active:scale-95 disabled:opacity-50 dark:bg-white/10 dark:text-[#c4c9bf] dark:hover:bg-white/15";

/** POSTs `/enrich` again. Only rendered when enrichment failed (`status === "error"`). */
export function EnrichCaptureButton({ captureId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onEnrich(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/captures/${captureId}/enrich`, {
        method: "POST",
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(body.error ?? `Failed (${res.status})`);
        router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setErr("Network error");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (String(status ?? "").toLowerCase() !== "error") {
    return null;
  }

  return (
    <>
      <p className="mb-1 text-center text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Analysis failed.
      </p>
      <button
        type="button"
        onClick={onEnrich}
        disabled={busy}
        className={retryButtonClass}
      >
        {busy ? "Working…" : "Retry"}
      </button>
      {err ? (
        <p
          className="max-w-full text-center text-xs text-red-600 dark:text-red-400"
          role="alert"
        >
          {err}
        </p>
      ) : null}
    </>
  );
}
