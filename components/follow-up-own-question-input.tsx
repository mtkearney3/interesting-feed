"use client";

import {
  captureBodyCopySizeClass,
  captureSectionLabelSizeClass,
} from "@/lib/capture-ui";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  /** Extra classes on the outer wrapper (e.g. `mt-3` when inline after “Keep going”). */
  className?: string;
};

export function FollowUpOwnQuestionInput({
  value,
  onChange,
  onSubmit,
  busy,
  className = "",
}: Props) {
  return (
    <div className={`space-y-1.5 sm:space-y-2 ${className}`.trim()}>
      <p
        className={`${captureSectionLabelSizeClass} text-zinc-500 dark:text-zinc-500`}
      >
        Your question
      </p>
      <div className="flex w-full items-center rounded-xl border border-blue-200 bg-white px-3 py-2 shadow-sm transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:border-blue-900/40 dark:bg-zinc-900 dark:focus-within:border-blue-500 dark:focus-within:ring-blue-950/40">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (busy || !value.trim()) return;
              onSubmit();
            }
          }}
          placeholder="Ask your own follow-up..."
          className={`min-w-0 flex-1 border-0 bg-transparent py-1 ${captureBodyCopySizeClass} text-blue-700 outline-none placeholder:text-gray-400 dark:text-blue-300 dark:placeholder:text-zinc-500`}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => onSubmit()}
          className={`ml-2 shrink-0 ${captureBodyCopySizeClass} font-medium text-blue-600 transition hover:text-blue-700 active:opacity-80 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300`}
        >
          {busy ? "Asking…" : "Ask"}
        </button>
      </div>
    </div>
  );
}
