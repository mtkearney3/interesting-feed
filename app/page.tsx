import { CaptureForm } from "./capture-form";
import { CaptureFeedCard } from "@/components/capture-feed-card";
import type { CaptureRow } from "@/lib/capture";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: captures, error } = await supabase
    .from("captures")
    .select(
      "id, raw_text, url, source, user_note, capture_type, image_url, ai_title, ai_summary, ai_why_interesting, ai_category, ai_insight_score, ai_followup_questions, ai_related_notes, status, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-xl font-semibold text-foreground">Captures</h1>
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          Could not load captures: {error.message}
        </p>
      </div>
    );
  }

  const rows = (captures ?? []) as CaptureRow[];

  return (
    <div className="mx-auto max-w-2xl flex-1 px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Captures
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {rows.length === 0
            ? "No captures yet."
            : `${rows.length} capture${rows.length === 1 ? "" : "s"}`}
        </p>
      </header>

      <CaptureForm />

      <ul className="flex flex-col gap-4">
        {rows.map((c) => (
          <li key={c.id}>
            <CaptureFeedCard c={c} />
          </li>
        ))}
      </ul>
    </div>
  );
}
