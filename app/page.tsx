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
      <div className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-lg font-semibold text-foreground">Captures</h1>
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          Could not load captures: {error.message}
        </p>
      </div>
    );
  }

  const rows = (captures ?? []) as CaptureRow[];
  const count = rows.length;

  return (
    <div className="min-h-0 flex-1 bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-200/90 bg-white/85 backdrop-blur-md dark:border-zinc-800/90 dark:bg-zinc-950/90 sm:static sm:z-0 sm:border-transparent sm:bg-transparent sm:backdrop-blur-none">
        <div className="mx-auto max-w-xl px-4 py-3 sm:mb-6 sm:px-0 sm:py-0">
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
            Captures
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
            {count === 0
              ? "No captures yet."
              : `${count} ${count === 1 ? "capture" : "captures"}`}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-4 sm:py-8">
        <CaptureForm />

        <ul className="flex flex-col gap-3 sm:gap-4">
          {rows.map((c) => (
            <li key={c.id} className="min-w-0">
              <CaptureFeedCard c={c} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
