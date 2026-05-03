"use client";

import Link from "next/link";

type Props = {
  onAddClip: () => void;
};

export function RabbitHoleFeedEmptyState({ onAddClip }: Props) {
  return (
    <section
      className="rounded-2xl border border-zinc-200/90 bg-white/95 px-5 py-8 shadow-sm dark:border-zinc-600/90 dark:bg-zinc-900/95 sm:px-8 sm:py-10"
      aria-labelledby="rabbit-hole-empty-title"
    >
      <h2
        id="rabbit-hole-empty-title"
        className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl"
      >
        Start your first rabbit hole
      </h2>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Save a screenshot, article, post, or thought. Rabbit Hole will turn it
        into a quick explanation with follow-up questions.
      </p>

      <ol className="mt-6 max-w-md space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
        <li className="flex gap-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100"
            aria-hidden
          >
            1
          </span>
          <span className="min-w-0 pt-0.5 leading-snug">
            Add a clip (screenshot, URL, or anything you want to explore)
          </span>
        </li>
        <li className="flex gap-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100"
            aria-hidden
          >
            2
          </span>
          <span className="min-w-0 pt-0.5 leading-snug">
            {
              "Send it to Rabbit Hole and we'll break it down instantly"
            }
          </span>
        </li>
        <li className="flex gap-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100"
            aria-hidden
          >
            3
          </span>
          <span className="min-w-0 pt-0.5 leading-snug">
            Review your clips in your personalized AI feed to dive deeper —
            uncover more insights and related ideas
          </span>
        </li>
      </ol>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:gap-5">
        <button
          type="button"
          onClick={onAddClip}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#263526] via-[#2f3e2f] to-[#4a3f20] px-5 py-3 text-sm font-semibold text-white shadow-md ring-1 ring-[#d4a017]/35 transition hover:brightness-105 active:scale-[0.98]"
        >
          Add a clip
        </button>
        <div className="flex flex-col items-center gap-2">
          <Link
            href="/shortcut"
            className="inline-flex w-full max-w-sm items-center justify-center rounded-xl border border-zinc-200/90 bg-zinc-50/90 px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-100 active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 sm:w-auto"
          >
            Set up iPhone Shortcut
          </Link>
          <p className="max-w-sm text-center text-xs leading-snug text-zinc-500 dark:text-zinc-400">
            Quickly send screenshots, links, and posts to Rabbit Hole from your
            iPhone
          </p>
        </div>
      </div>
    </section>
  );
}
