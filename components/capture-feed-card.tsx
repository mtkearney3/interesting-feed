import { parseFollowupQuestions, type CaptureRow } from "@/lib/capture";
import { CaptureCardLead } from "@/components/capture-card-lead";
import { CaptureFollowupsPanel } from "@/components/capture-followups-panel";
import { EnrichCaptureButton } from "@/components/enrich-capture-button";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
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

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
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

      {hasAi ? (
        <CaptureFollowupsPanel
          captureId={c.id}
          presetQuestions={presetFollowups}
        />
      ) : null}

      {c.image_url ? (
        <img
          src={c.image_url}
          alt=""
          className="mt-3 max-h-48 w-auto rounded-md border border-zinc-200 object-contain dark:border-zinc-700"
        />
      ) : null}

      {c.url ? (
        <p className="mt-3 text-sm">
          <a
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            {c.url}
          </a>
        </p>
      ) : null}

      <dl className="mt-4 grid gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        {hasAi ? (
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            <dt className="font-medium text-zinc-500 dark:text-zinc-500">
              Original text
            </dt>
            <dd className="min-w-0 flex-1 whitespace-pre-wrap">
              {c.raw_text?.trim() ? c.raw_text : "—"}
            </dd>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <dt className="font-medium text-zinc-500 dark:text-zinc-500">
            Type
          </dt>
          <dd>{c.capture_type ?? "—"}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <dt className="font-medium text-zinc-500 dark:text-zinc-500">
            Source
          </dt>
          <dd>{c.source ?? "—"}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <dt className="font-medium text-zinc-500 dark:text-zinc-500">
            Note
          </dt>
          <dd className="min-w-0 flex-1 whitespace-pre-wrap">
            {c.user_note?.trim() ? c.user_note : "—"}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <dt className="font-medium text-zinc-500 dark:text-zinc-500">
            Created
          </dt>
          <dd>{formatDate(c.created_at)}</dd>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <dt className="font-medium text-zinc-500 dark:text-zinc-500">
            Status
          </dt>
          <dd>
            <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
              {c.status ?? "—"}
            </span>
          </dd>
        </div>
      </dl>

      <EnrichCaptureButton captureId={c.id} status={c.status} />
    </article>
  );
}
