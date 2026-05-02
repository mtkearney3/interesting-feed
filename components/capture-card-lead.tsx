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
> & {
  /** When card shows media above this block (tighter title spacing on mobile). */
  mediaOnTop?: boolean;
  /** Modal/detail: no line clamps, full text. */
  detailMode?: boolean;
  /** Hide AI title line (e.g. when the modal header already shows the title). */
  suppressTitle?: boolean;
  /** Feed: title is rendered above the card (CaptureFeedCard); skip duplicate title here. */
  omitFeedTitle?: boolean;
};

function scoreLabel(score: number | null): string | null {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return null;
  }
  const rounded = Math.round(score * 10) / 10;
  return `${rounded}/10`;
}

export function CaptureCardLead(props: LeadFields) {
  const hasAi = Boolean(props.ai_title?.trim());
  const s = String(props.status ?? "").toLowerCase();
  const thinking =
    (s === "processing" || s === "analyzing") && !hasAi;
  const titleTight = props.mediaOnTop;
  const d = props.detailMode;
  const aiSpacing = d
    ? "space-y-3 sm:space-y-4"
    : `space-y-1 max-sm:space-y-1 sm:space-y-2.5 ${titleTight ? "max-sm:space-y-0.5" : ""}`;

  const aiBody = (
    <>
      <p
        className={
          d
            ? "text-base leading-relaxed text-zinc-700 dark:text-zinc-200 sm:text-lg"
            : "line-clamp-3 text-base leading-relaxed text-zinc-600 dark:text-zinc-300 sm:line-clamp-none sm:text-lg"
        }
      >
        {props.ai_summary}
      </p>
      <p
        className={
          d
            ? "text-base leading-relaxed text-zinc-700 dark:text-zinc-300 sm:text-lg"
            : "line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-500 sm:line-clamp-none sm:text-zinc-600 dark:sm:text-zinc-400"
        }
      >
        <span className="font-medium text-zinc-500 dark:text-zinc-500 sm:font-semibold">
          Why it&apos;s interesting:{" "}
        </span>
        {props.ai_why_interesting}
      </p>
      <div
        className={
          d
            ? "flex flex-wrap items-center gap-2 text-sm sm:text-base"
            : "flex flex-wrap items-center gap-1.5 text-sm sm:gap-2 sm:text-xs"
        }
      >
        {props.ai_category ? (
          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-200 sm:px-2.5">
            {props.ai_category}
          </span>
        ) : null}
        {scoreLabel(props.ai_insight_score) ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200 sm:px-2.5">
            Insight {scoreLabel(props.ai_insight_score)}
          </span>
        ) : null}
      </div>
      {props.ai_related_notes?.trim() ? (
        <p
          className={
            d
              ? "text-base leading-relaxed text-zinc-700 dark:text-zinc-300 sm:text-lg"
              : "line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:line-clamp-none sm:text-sm"
          }
        >
          <span className="font-medium text-zinc-500 dark:text-zinc-500 sm:font-semibold">
            Notes:{" "}
          </span>
          {props.ai_related_notes}
        </p>
      ) : null}
    </>
  );

  return (
    <div>
      {thinking ? (
        <div className="mb-1.5 space-y-1.5" role="status" aria-live="polite">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            <span className="capture-thinking-dots relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-35 dark:bg-violet-300" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500 dark:bg-violet-400" />
            </span>
            <span>Analyzing…</span>
          </div>
          <div className="space-y-1.5" aria-hidden>
            <div className="capture-skeleton-shimmer h-2.5 w-[78%] rounded-md" />
            <div className="capture-skeleton-shimmer h-2.5 w-full rounded-md" />
            <div className="capture-skeleton-shimmer h-2.5 w-[62%] rounded-md" />
          </div>
        </div>
      ) : null}

      {hasAi ? (
        <div className={`capture-ai-enter ${aiSpacing}`}>
          {props.suppressTitle || props.omitFeedTitle ? null : (
            <h2
              className={`font-bold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50 ${titleTight ? "text-lg max-sm:mt-0 sm:text-xl" : "text-lg sm:text-xl"}`}
            >
              {props.ai_title}
            </h2>
          )}
          {aiBody}
        </div>
      ) : (
        <p
          className={
            d
              ? "whitespace-pre-wrap text-base leading-relaxed text-zinc-900 dark:text-zinc-100 sm:text-lg"
              : "line-clamp-5 whitespace-pre-wrap text-base leading-relaxed text-zinc-900 dark:text-zinc-100 sm:line-clamp-none sm:text-lg"
          }
        >
          {props.raw_text ?? "—"}
        </p>
      )}
    </div>
  );
}
