"use client";

import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  captureRawTextForDisplay,
  captureStatusDisplay,
  captureUrlForFeedDisplay,
  formatCaptureDateShort,
  parseFollowupQuestions,
  type CaptureRow,
} from "@/lib/capture";
import { CaptureCardLead } from "@/components/capture-card-lead";
import { CaptureFeedTitleBrandDot } from "@/components/capture-sticky-feed-title-dual";
import { CaptureFollowupsPanel } from "@/components/capture-followups-panel";
import { DeleteCaptureButton } from "@/components/delete-capture-button";
import { useFeedClipStatusOptional } from "@/components/feed-clip-status-context";
import { EnrichCaptureButton } from "@/components/enrich-capture-button";
import { RabbitHolePageShell } from "@/components/rabbit-hole-page-shell";
import {
  captureBodyCopySizeClass,
  captureMetadataTextSizeClass,
  captureScreenshotSourceUrlClass,
  captureSectionLabelSizeClass,
} from "@/lib/capture-ui";
import { screenshotSourceLinkFromCapture } from "@/lib/capture-screenshot-source-url";
import {
  rabbitHoleBlendedHeaderCollapsedChrome,
  rabbitHoleBlendedHeaderExpandedChrome,
  rabbitHoleMainWidthClass,
} from "@/lib/rabbit-hole-layout";

const detailScrollShellClass =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain sm:rounded-2xl sm:ring-1 sm:ring-zinc-200/80 dark:sm:ring-zinc-800";

type Props = {
  capture: CaptureRow | null;
  onClose: () => void;
};

export function CaptureDetailModal({ capture, onClose }: Props) {
  const titleId = useId();
  const detailScrollRef = useRef<HTMLDivElement>(null);
  const [detailScrolled, setDetailScrolled] = useState(false);
  const feedClipStatus = useFeedClipStatusOptional();
  const markClipReviewed = feedClipStatus?.markClipReviewed;

  const onDetailScroll = useCallback(() => {
    const el = detailScrollRef.current;
    if (!el) return;
    setDetailScrolled(el.scrollTop > 20);
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!capture) return;
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [capture, onKeyDown]);

  useEffect(() => {
    if (!capture) return;
    setDetailScrolled(false);
    const el = detailScrollRef.current;
    if (el) {
      el.scrollTop = 0;
    }
  }, [capture]);

  useEffect(() => {
    if (!capture?.id || !markClipReviewed) return;
    markClipReviewed(String(capture.id));
  }, [capture?.id, markClipReviewed]);

  if (!capture) return null;

  const c = capture;
  const hasAi = Boolean(c.ai_title?.trim());
  const presetFollowups = hasAi
    ? parseFollowupQuestions(c.ai_followup_questions)
    : [];
  const displayRaw = captureRawTextForDisplay(c.raw_text, c.image_url);
  const displayUrl = captureUrlForFeedDisplay(c);
  const hasMetaExtra =
    Boolean(c.user_note?.trim()) || (hasAi && Boolean(displayRaw?.trim()));
  const hasImage = Boolean(c.image_url);
  const screenshotSourceLink = screenshotSourceLinkFromCapture(c);

  const headerTitle =
    hasAi && c.ai_title?.trim()
      ? c.ai_title.trim()
      : displayRaw?.trim()
        ? displayRaw.trim().slice(0, 120) +
          (displayRaw.trim().length > 120 ? "…" : "")
        : hasImage
          ? "Screenshot"
          : "Clip";

  return (
    <RabbitHolePageShell className="fixed inset-0 z-[100] flex flex-col sm:items-center sm:justify-center sm:p-6">
      <div
        className="absolute inset-0 bg-transparent"
        aria-hidden
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex h-full max-h-full min-h-0 w-full flex-1 flex-col bg-transparent shadow-none sm:h-auto sm:max-h-[min(90vh,880px)] sm:max-w-2xl sm:flex-none sm:shadow-2xl"
      >
        <div
          ref={detailScrollRef}
          className={`${detailScrollShellClass} bg-transparent`}
          onScroll={onDetailScroll}
        >
          <header
            className={`sticky top-0 z-50 w-full ${detailScrolled ? rabbitHoleBlendedHeaderCollapsedChrome : rabbitHoleBlendedHeaderExpandedChrome}`}
          >
            <div className={`${rabbitHoleMainWidthClass} px-3`}>
              <div className="flex w-full items-start gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Back"
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15 active:scale-95"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start gap-2">
                    <CaptureFeedTitleBrandDot align="detail" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col">
                        <h1
                          id={titleId}
                          className="break-words text-base font-semibold leading-tight text-white"
                        >
                          {headerTitle}
                        </h1>
                        <p
                          className={`mt-0.5 ${captureMetadataTextSizeClass} text-white/75`}
                        >
                          <time dateTime={c.created_at} className="tabular-nums">
                            {formatCaptureDateShort(c.created_at)}
                          </time>
                        </p>
                      </div>
                      {String(c.status ?? "").toLowerCase() === "error" ? (
                        <p className="mt-1 text-sm font-medium text-red-300">
                          {captureStatusDisplay(c.status)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="mt-3 px-3 pb-4 sm:px-5 sm:pb-6">
            <div className="flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
              {hasImage ? (
                <div>
                  <div className="overflow-hidden rounded-xl bg-black shadow-sm dark:shadow-none dark:ring-1 dark:ring-zinc-800">
                    <img
                      src={c.image_url!}
                      alt=""
                      className="w-full max-h-[85vh] object-contain object-center sm:max-h-[min(85vh,720px)]"
                    />
                  </div>
                  {screenshotSourceLink ? (
                    <p className="mt-2 min-w-0">
                      <a
                        href={screenshotSourceLink.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={captureScreenshotSourceUrlClass}
                      >
                        {screenshotSourceLink.label}
                      </a>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div
                className={`min-w-0 space-y-4 sm:space-y-5 ${hasImage ? "mt-4" : ""}`}
              >
                <CaptureCardLead
                  status={c.status}
                  raw_text={hasImage ? displayRaw : c.raw_text}
                  ai_title={c.ai_title}
                  ai_summary={c.ai_summary}
                  ai_why_interesting={c.ai_why_interesting}
                  ai_category={c.ai_category}
                  ai_insight_score={c.ai_insight_score}
                  ai_related_notes={c.ai_related_notes}
                  mediaOnTop={hasImage}
                  detailMode
                  suppressTitle={hasAi}
                />

                {displayUrl ? (
                  <p className={`min-w-0 break-words ${captureBodyCopySizeClass}`}>
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
                  <CaptureFollowupsPanel
                    captureId={c.id}
                    presetQuestions={presetFollowups}
                  />
                ) : null}

                {hasMetaExtra ? (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/80">
                    <p
                      className={`${captureSectionLabelSizeClass} text-zinc-500 dark:text-zinc-400`}
                    >
                      Note &amp; original text
                    </p>
                    <div
                      className={`mt-2 space-y-3 border-t border-zinc-200 pt-3 ${captureBodyCopySizeClass} text-zinc-700 dark:border-zinc-800 dark:text-zinc-300`}
                    >
                      <p>
                        <span className="font-semibold text-zinc-600 dark:text-zinc-400">
                          Note:{" "}
                        </span>
                        <span className="whitespace-pre-wrap">
                          {c.user_note?.trim() ? c.user_note : "—"}
                        </span>
                      </p>
                      {hasAi ? (
                        <p>
                          <span className="font-semibold text-zinc-600 dark:text-zinc-400">
                            Original:{" "}
                          </span>
                          <span className="whitespace-pre-wrap">
                            {displayRaw?.trim() ? displayRaw : "—"}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {String(c.status ?? "").toLowerCase() === "error" ? (
                  <div className="flex flex-col items-center gap-1 border-t border-zinc-200 pt-2 dark:border-zinc-800">
                    <EnrichCaptureButton captureId={c.id} status={c.status} />
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex justify-end">
                <DeleteCaptureButton captureId={c.id} onDeleted={onClose} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </RabbitHolePageShell>
  );
}
