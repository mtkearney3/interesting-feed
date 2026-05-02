"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CaptureForm } from "@/app/capture-form";
import { CaptureFeedCard } from "@/components/capture-feed-card";
import { CaptureDetailModal } from "@/components/capture-detail-modal";
import type { CaptureRow } from "@/lib/capture";

type Props = {
  rows: CaptureRow[];
};

export function CaptureFeedWithDetail({ rows }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<CaptureRow | null>(null);
  const startedEnrichRef = useRef(new Set<string>());

  const analyzingKey = useMemo(() => {
    return rows
      .filter((r) => {
        const s = String(r.status ?? "").toLowerCase();
        const pendingAi = !String(r.ai_title ?? "").trim();
        return pendingAi && (s === "analyzing" || s === "processing");
      })
      .map((r) => r.id)
      .join(",");
  }, [rows]);

  useEffect(() => {
    if (!analyzingKey) return;
    const id = window.setInterval(() => {
      queueMicrotask(() => {
        router.refresh();
      });
    }, 3500);
    return () => clearInterval(id);
  }, [analyzingKey, router]);

  useEffect(() => {
    for (const clip of rows) {
      const s = String(clip.status ?? "").toLowerCase();
      const pendingAi = !String(clip.ai_title ?? "").trim();
      if (!pendingAi || (s !== "analyzing" && s !== "processing")) continue;
      if (startedEnrichRef.current.has(clip.id)) continue;
      startedEnrichRef.current.add(clip.id);
      queueMicrotask(() => {
        void fetch(`/api/captures/${clip.id}/enrich`, { method: "POST" }).catch(
          () => {
            /* Retry on card if needed */
          }
        );
      });
    }
  }, [rows]);

  return (
    <>
      <CaptureForm />
      <ul className="flex flex-col">
        {rows.map((c) => (
          <li key={c.id} className="min-w-0">
            <CaptureFeedCard c={c} onOpenDetail={() => setSelected(c)} />
          </li>
        ))}
      </ul>
      <CaptureDetailModal
        capture={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
