import { parseFollowupQuestions, type CaptureRow } from "@/lib/capture";
import { CaptureCardLead } from "@/components/capture-card-lead";
import { CaptureFollowupsPanel } from "@/components/capture-followups-panel";
import { EnrichCaptureButton } from "@/components/enrich-capture-button";

function formatDateShort(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function CaptureFeedCard({ c }: { c: CaptureRow }) {
  const hasAi = Boolean(c.ai_title?.trim());
  const presetFollowups = hasAi
    ? parseFollowupQuestions(c.ai_followup_questions)
    : [];
  const hasMetaExtra =
    Boolean(c.user_note?.trim()) || (hasAi && Boolean(c.raw_text?.trim()));

  return (
    <article className="w-full min-w-0 overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="p-3 sm:p-4">
        <CaptureCardLead
          status={c.status}
          raw_text={c.raw_text}
          ai_title={c.ai_title}
          ai_summary={c.ai_summary}
          ai_why_interesting={c.ai_why_interesting}
          ai_category={c.ai_category}
          ai_insight_score={c.ai_insight_score}
          ai_related_notes={c.ai_related_notes}
        />

        {c.image_url ? (
          <div className="mt-3 -mx-3 sm:-mx-4">
            <img
              src={c.image_url}
              alt=""
              className="max-h-56 w-full rounded-lg bg-zinc-100 object-contain dark:bg-zinc-950 sm:max-h-64"
            />
          </div>
        ) : null}

        {c.url ? (
          <p className="mt-3 min-w-0 break-words text-sm">
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

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-zinc-100 pt-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span className="font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            {c.capture_type ?? "—"}
          </span>
          <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
            ·
          </span>
          <span className="max-w-[40%] truncate font-medium text-zinc-600 dark:text-zinc-300">
            {c.source ?? "—"}
          </span>
          <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
            ·
          </span>
          <time
            className="tabular-nums text-zinc-500 dark:text-zinc-400"
            dateTime={c.created_at}
          >
            {formatDateShort(c.created_at)}
          </time>
          <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
            ·
          </span>
          <span className="inline-flex shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
            {c.status ?? "—"}
          </span>
        </div>

        {hasMetaExtra ? (
          <details className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50/80 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-950/50">
            <summary className="cursor-pointer list-none py-1.5 text-xs font-medium text-zinc-600 marker:hidden [&::-webkit-details-marker]:hidden dark:text-zinc-400">
              Note &amp; original text
            </summary>
            <div className="space-y-2 border-t border-zinc-200/80 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
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

        <div className="mt-3 max-sm:[&_button]:w-full">
          <EnrichCaptureButton captureId={c.id} status={c.status} />
        </div>
      </div>
    </article>
  );
}
