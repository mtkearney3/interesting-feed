"use client";

import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useId } from "react";
import {
  captureStatusDisplay,
  formatCaptureDateShort,
  parseFollowupQuestions,
  type CaptureRow,
} from "@/lib/capture";
import { CaptureCardLead } from "@/components/capture-card-lead";
import { CaptureFeedTitleBrandDot } from "@/components/capture-sticky-feed-title-dual";
import { CaptureFollowupsPanel } from "@/components/capture-followups-panel";
import { DeleteCaptureButton } from "@/components/delete-capture-button";
import { EnrichCaptureButton } from "@/components/enrich-capture-button";

type Props = {
  capture: CaptureRow | null;
  onClose: () => void;
};

export function CaptureDetailModal({ capture, onClose }: Props) {
  const titleId = useId();

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

  if (!capture) return null;

  const c = capture;
  const hasAi = Boolean(c.ai_title?.trim());
  const presetFollowups = hasAi
    ? parseFollowupQuestions(c.ai_followup_questions)
    : [];
  const hasMetaExtra =
    Boolean(c.user_note?.trim()) || (hasAi && Boolean(c.raw_text?.trim()));
  const hasImage = Boolean(c.image_url);

  const headerTitle =
    hasAi && c.ai_title?.trim()
      ? c.ai_title.trim()
      : c.raw_text?.trim()
        ? c.raw_text.trim().slice(0, 120) +
          (c.raw_text.trim().length > 120 ? "…" : "")
        : "Clip";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col sm:items-center sm:justify-center sm:p-6">
      <div
        className="absolute inset-0 bg-zinc-950/55 dark:bg-black/70"
        aria-hidden
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex h-full max-h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-zinc-50 shadow-2xl dark:bg-zinc-950 sm:h-auto sm:max-h-[min(90vh,880px)] sm:max-w-2xl sm:flex-none sm:rounded-2xl sm:ring-1 sm:ring-zinc-200/80 dark:sm:ring-zinc-800"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <header className="sticky top-0 z-50 bg-transparent px-3 pt-0 pb-0 sm:px-5">
            <div className="flex w-full items-start gap-3 rounded-2xl border border-zinc-200/70 bg-white px-3 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition active:scale-95 dark:bg-zinc-800 dark:text-zinc-200"
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
                        className="break-words text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-50"
                      >
                        {headerTitle}
                      </h1>
                      <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                        <time dateTime={c.created_at} className="tabular-nums">
                          {formatCaptureDateShort(c.created_at)}
                        </time>
                      </p>
                    </div>
                    {String(c.status ?? "").toLowerCase() === "error" ? (
                      <p className="mt-1 text-sm font-medium text-red-600 dark:text-red-400">
                        {captureStatusDisplay(c.status)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="mt-3 px-3 pb-4 sm:px-5 sm:pb-6">
            <div className="flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
              {hasImage ? (
                <div className="rounded-xl overflow-hidden bg-black shadow-sm dark:shadow-none dark:ring-1 dark:ring-zinc-800">
                  <img
                    src={c.image_url!}
                    alt=""
                    className="w-full max-h-[85vh] object-contain object-center sm:max-h-[min(85vh,720px)]"
                  />
                </div>
              ) : null}

              <div
                className={`min-w-0 space-y-4 sm:space-y-5 ${hasImage ? "mt-4" : ""}`}
              >
                <CaptureCardLead
                  status={c.status}
                  raw_text={c.raw_text}
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

                {c.url ? (
                  <p className="min-w-0 break-words text-base">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sky-700 underline decoration-sky-700/30 underline-offset-2 hover:decoration-sky-700 dark:text-sky-400 dark:decoration-sky-400/30"
                    >
                      {c.url}
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Note &amp; original text
                    </p>
                    <div className="mt-2 space-y-3 border-t border-zinc-200 pt-3 text-sm leading-relaxed text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
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
                            {c.raw_text?.trim() ? c.raw_text : "—"}
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
    </div>
  );
}
