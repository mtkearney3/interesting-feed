"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  captureId: string;
  status: string | null;
};

export function EnrichCaptureButton({ captureId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onEnrich() {
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

  const idleLabel =
    status === "error" || status === "processing"
      ? "Retry enrich"
      : "Enrich";

  return (
    <div className="mt-3 flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onEnrich}
        disabled={busy}
        className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {busy ? "Enriching…" : idleLabel}
      </button>
      {err ? (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
