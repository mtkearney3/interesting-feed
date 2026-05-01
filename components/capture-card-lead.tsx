"use client";

import type { CaptureRow } from "@/lib/capture";

type LeadFields = Pick<
  CaptureRow,
  | "status"
  | "raw_text"
  | "ai_title"
  | "ai_summary"
  | "ai_why_interesting"
  | "ai_category"
  | "ai_insight_score"
  | "ai_related_notes"
>;

function scoreLabel(score: number | null): string | null {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return null;
  }
  const rounded = Math.round(score * 10) / 10;
  return `${rounded}/10`;
}

export function CaptureCardLead(props: LeadFields) {
  const hasAi = Boolean(props.ai_title?.trim());
  const thinking =
    props.status === "processing" && !hasAi;

  return (
    <div>
      {thinking ? (
        <div
          className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-zinc-500 dark:text-zinc-400"
          role="status"
          aria-live="polite"
        >
          <span className="capture-thinking-dots relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-35 dark:bg-violet-300" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500 dark:bg-violet-400" />
          </span>
          <span className="opacity-90">Thinking…</span>
        </div>
      ) : null}

      {hasAi ? (
        <div className="capture-ai-enter space-y-2.5 sm:space-y-3">
          <h2 className="text-xl font-bold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
            {props.ai_title}
          </h2>
          <p className="text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300 sm:text-base">
            {props.ai_summary}
          </p>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-zinc-500 dark:text-zinc-500">
              Why it&apos;s interesting:{" "}
            </span>
            {props.ai_why_interesting}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {props.ai_category ? (
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-200">
                {props.ai_category}
              </span>
            ) : null}
            {scoreLabel(props.ai_insight_score) ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Insight {scoreLabel(props.ai_insight_score)}
              </span>
            ) : null}
          </div>
          {props.ai_related_notes?.trim() ? (
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold text-zinc-500 dark:text-zinc-500">
                Notes:{" "}
              </span>
              {props.ai_related_notes}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-900 dark:text-zinc-100">
          {props.raw_text ?? "—"}
        </p>
      )}
    </div>
  );
}
