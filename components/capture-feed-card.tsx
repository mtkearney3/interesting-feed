"use client";

import type { MouseEvent } from "react";
import { FileText, Image as ImageIcon, Link } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  captureRawTextForDisplay,
  captureUrlForFeedDisplay,
  feedCaptureTypeDisplay,
  formatCaptureDateShort,
  parseFollowupQuestions,
  type CaptureRow,
} from "@/lib/capture";
import {
  captureBodyCopySizeClass,
  captureMetadataTextSizeClass,
} from "@/lib/capture-ui";
import { CaptureCardLead } from "@/components/capture-card-lead";
import { useFeedClipStatusOptional } from "@/components/feed-clip-status-context";
import { StickyClipTitle } from "@/components/capture-sticky-feed-title-dual";
import { CaptureFollowupsPanel } from "@/components/capture-followups-panel";
import { DeleteCaptureButton } from "@/components/delete-capture-button";
import { EnrichCaptureButton } from "@/components/enrich-capture-button";
function stopOpenDetail(e: MouseEvent) {
  e.stopPropagation();
}

const feedMetaIconClass =
  "h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500";

/** Small icon for clip kind (matches `feedCaptureTypeDisplay` semantics). */
function FeedKindCaptureIcon({ c }: { c: CaptureRow }) {
  const raw = feedCaptureTypeDisplay(c).trim().toLowerCase();
  if (raw === "link" || raw === "url") {
    return <Link className={feedMetaIconClass} strokeWidth={2} aria-hidden />;
  }
  if (raw === "screenshot" || raw === "image") {
    return (
      <ImageIcon className={feedMetaIconClass} strokeWidth={2} aria-hidden />
    );
  }
  return (
    <FileText className={feedMetaIconClass} strokeWidth={2} aria-hidden />
  );
}

const feedStatusBadgeBaseClass =
  "shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5";

const feedStatusNewBadgeClass = `${feedStatusBadgeBaseClass} bg-amber-100/95 text-amber-900 dark:bg-amber-950/55 dark:text-amber-200`;

const feedStatusReviewedBadgeClass = `${feedStatusBadgeBaseClass} bg-zinc-100 text-zinc-500 dark:bg-zinc-800/90 dark:text-zinc-400`;

function isEnrichmentError(status: string | null): boolean {
  return String(status ?? "").toLowerCase() === "error";
}

function isAnalyzingStatus(status: string | null): boolean {
  const s = String(status ?? "").toLowerCase();
  return s === "analyzing" || s === "processing";
}

/**
 * After 10s: “Still analyzing…”. After 15s: optional POST /enrich retry (covers dev where
 * `after()` may not run).
 */
function AnalyzingStatusBlock({
  captureId,
  active,
  onBlockClick,
}: {
  captureId: string;
  active: boolean;
  onBlockClick?: (e: MouseEvent) => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const [retryBusy, setRetryBusy] = useState(false);

  useEffect(() => {
    if (!active) return;
    const t1 = window.setTimeout(() => setPhase(1), 10_000);
    const t2 = window.setTimeout(() => setPhase(2), 15_000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [active, captureId]);

  const onRetry = useCallback(
    async (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (retryBusy) return;
      setRetryBusy(true);
      try {
        await fetch(`/api/captures/${captureId}/enrich`, { method: "POST" });
        router.refresh();
      } finally {
        setRetryBusy(false);
      }
    },
    [captureId, retryBusy, router]
  );

  if (!active || phase === 0) return null;

  return (
    <div
      className="mt-1 space-y-1.5"
      onClick={onBlockClick}
      role="status"
      aria-live="polite"
    >
      {phase >= 1 ? (
        <p
          className={`${captureMetadataTextSizeClass} font-medium text-zinc-400 dark:text-zinc-500`}
        >
          Still analyzing…
        </p>
      ) : null}
      {phase >= 2 ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retryBusy}
          className={`inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 ${captureMetadataTextSizeClass} font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700`}
        >
          {retryBusy ? "Retrying…" : "Retry analysis"}
        </button>
      ) : null}
    </div>
  );
}

type Props = {
  c: CaptureRow;
  onOpenDetail?: () => void;
};

export function CaptureFeedCard({ c, onOpenDetail }: Props) {
  const feedClipStatus = useFeedClipStatusOptional();
  const statusBadge =
    feedClipStatus?.clipBadge(String(c.id), c.created_at) ?? null;
  const hasAi = Boolean(c.ai_title?.trim());
  const analyzing = isAnalyzingStatus(c.status) && !hasAi;
  const presetFollowups = hasAi
    ? parseFollowupQuestions(c.ai_followup_questions)
    : [];
  const displayRaw = captureRawTextForDisplay(c.raw_text, c.image_url);
  const displayUrl = captureUrlForFeedDisplay(c);
  const hasMetaExtra =
    Boolean(c.user_note?.trim()) || (hasAi && Boolean(displayRaw?.trim()));
  const hasImage = Boolean(c.image_url);
  const interactive = Boolean(onOpenDetail);
  const omitFeedTitle = hasAi && Boolean(c.ai_title?.trim());

  const titleStatusBadge =
    statusBadge === "new" ? (
      <span className={feedStatusNewBadgeClass}>New</span>
    ) : statusBadge === "reviewed" ? (
      <span className={feedStatusReviewedBadgeClass}>Reviewed</span>
    ) : null;

  return (
    <article
      id={`clip-${c.id}`}
      onClick={onOpenDetail ? () => onOpenDetail() : undefined}
      className={`relative mb-5 w-full min-w-0 overflow-visible rounded-2xl border border-zinc-200 bg-white px-0 pb-4 pt-0 shadow-md transition hover:shadow-md max-sm:touch-manipulation dark:border-zinc-700 dark:bg-zinc-800 sm:py-4 ${interactive ? "cursor-pointer" : ""}`}
    >
      <StickyClipTitle clip={c} titleTrailing={titleStatusBadge} />

      {hasImage ? (
        <div className="mb-0 w-full px-4 pt-2 pb-1">
          <div className="isolate w-full overflow-hidden rounded-xl border border-black/5 bg-black shadow-sm dark:border-white/10 sm:bg-zinc-100 dark:sm:bg-zinc-950">
            <img
              src={c.image_url!}
              alt=""
              className="block h-auto w-full max-sm:max-h-[55vh] rounded-xl object-contain object-center sm:max-h-56 sm:object-top"
            />
          </div>
        </div>
      ) : null}

      <div className="px-4">
        <div
          className={`mb-3 flex items-center gap-2 text-sm tabular-nums text-zinc-500 dark:text-zinc-400 ${hasImage ? "mt-1" : "mt-2"}`}
          onClick={interactive ? stopOpenDetail : undefined}
        >
          <FeedKindCaptureIcon c={c} />
          <time className="min-w-0 shrink leading-snug" dateTime={c.created_at}>
            {formatCaptureDateShort(c.created_at)}
          </time>
        </div>
        <AnalyzingStatusBlock
          key={`${c.id}-${analyzing}`}
          captureId={c.id}
          active={analyzing}
          onBlockClick={interactive ? stopOpenDetail : undefined}
        />

        <div className="space-y-2 sm:space-y-3">
        <CaptureCardLead
          status={c.status}
          raw_text={hasImage ? displayRaw : c.raw_text}
          ai_title={c.ai_title}
          ai_summary={c.ai_summary}
          ai_why_interesting={c.ai_why_interesting}
          ai_category={c.ai_category}
          ai_insight_score={c.ai_insight_score}
          ai_related_notes={c.ai_related_notes}
          mediaOnTop={false}
          omitFeedTitle={omitFeedTitle}
        />

        {displayUrl ? (
          <p
            className={`min-w-0 break-words ${captureBodyCopySizeClass}`}
            onClick={interactive ? stopOpenDetail : undefined}
          >
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sky-700 underline decoration-sky-700/30 underline-offset-2 hover:decoration-sky-700 dark:text-sky-400 dark:decoration-sky-400/30"
            >
              {displayUrl}
            </a>
          </p>
        ) : null}

        {hasAi ? (
          <div onClick={interactive ? stopOpenDetail : undefined}>
            <CaptureFollowupsPanel
              captureId={c.id}
              presetQuestions={presetFollowups}
              enrichSlot={
                isEnrichmentError(c.status) ? (
                  <EnrichCaptureButton captureId={c.id} status={c.status} />
                ) : undefined
              }
            />
          </div>
        ) : null}

        {hasMetaExtra ? (
          <details
            className="rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-950/50"
            onClick={interactive ? stopOpenDetail : undefined}
          >
            <summary
              className={`cursor-pointer list-none py-1.5 ${captureMetadataTextSizeClass} font-medium text-zinc-600 marker:hidden [&::-webkit-details-marker]:hidden dark:text-zinc-400`}
            >
              Note &amp; original text
            </summary>
            <div
              className={`space-y-1.5 border-t border-zinc-200/80 py-2 ${captureBodyCopySizeClass} text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 sm:space-y-2`}
            >
              <p>
                <span className="font-semibold text-zinc-500 dark:text-zinc-500">
                  Note:{" "}
                </span>
                <span className="whitespace-pre-wrap">
                  {c.user_note?.trim() ? c.user_note : "—"}
                </span>
              </p>
              {hasAi ? (
                <p>
                  <span className="font-semibold text-zinc-500 dark:text-zinc-500">
                    Original:{" "}
                  </span>
                  <span className="whitespace-pre-wrap">
                    {c.raw_text?.trim() ? c.raw_text : "—"}
                  </span>
                </p>
              ) : null}
            </div>
          </details>
        ) : null}

        {!hasAi && isEnrichmentError(c.status) ? (
          <div
            className="flex flex-col items-center justify-center gap-1"
            onClick={interactive ? stopOpenDetail : undefined}
          >
            <EnrichCaptureButton captureId={c.id} status={c.status} />
          </div>
        ) : null}
        </div>

        <div className="mt-2 flex justify-end">
          <DeleteCaptureButton captureId={c.id} />
        </div>
      </div>
    </article>
  );
}
