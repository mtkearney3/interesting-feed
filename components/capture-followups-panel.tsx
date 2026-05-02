"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import type { FollowupStructuredResponse } from "@/lib/openai-followup-answer";
import {
  captureBodyCopySizeClass,
  captureSectionLabelSizeClass,
} from "@/lib/capture-ui";

const followUpQuestionBtnClass = `group flex w-full items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-left ${captureBodyCopySizeClass} font-medium text-blue-700 transition hover:bg-blue-100 active:scale-[0.98] dark:border-blue-900/45 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-950/60`;

/** Suggested follow-ups inside an answer card (not preset list). */
const keepGoingQuestionBtnClass = `flex w-full items-center justify-between rounded-xl border border-blue-100 bg-white px-3 py-2 text-left ${captureBodyCopySizeClass} font-medium text-blue-600 transition active:scale-[0.98] dark:border-blue-900/40 dark:bg-zinc-950 dark:text-blue-300`;

type Props = {
  captureId: string;
  presetQuestions: string[];
  enrichSlot?: ReactNode;
};

type AnswerEntry = {
  loading: boolean;
  error?: string;
  data?: FollowupStructuredResponse;
};

function AnswerUnderQuestion({
  answerKey,
  expanded,
  answersByKey,
  expandedByKey,
  onQuestionRowClick,
  nested = false,
}: {
  answerKey: string;
  expanded: boolean;
  answersByKey: Record<string, AnswerEntry>;
  expandedByKey: Record<string, boolean>;
  onQuestionRowClick: (key: string, questionText: string) => void;
  nested?: boolean;
}) {
  if (!expanded) return null;

  const state = answersByKey[answerKey];
  if (!state) return null;

  const loadingShell = `rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 ${captureBodyCopySizeClass} text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200`;
  const loadingShellNested = `mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 ${captureBodyCopySizeClass} text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200`;

  if (state.loading) {
    return (
      <div className={nested ? loadingShellNested : `ml-3 ${loadingShell}`}>
        Thinking…
      </div>
    );
  }

  const errorShell = `rounded-xl border border-red-200 bg-red-50 px-4 py-3 ${captureBodyCopySizeClass} text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200`;
  const errorShellNested = `mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 ${captureBodyCopySizeClass} text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200`;

  if (state.error) {
    return (
      <div className={nested ? errorShellNested : `ml-3 ${errorShell}`}>
        {state.error}
      </div>
    );
  }

  if (!state.data) return null;

  const { answer, followUps } = state.data;

  const keepGoing =
    followUps.length > 0 ? (
      <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-700/80">
        <p
          className={`mb-2 ${captureSectionLabelSizeClass} text-zinc-400 dark:text-zinc-500`}
        >
          Keep going
        </p>
        <div className="space-y-2">
          {followUps.map((fu, i) => {
            const childKey = `${answerKey}/fu/${i}`;
            const childOpen = expandedByKey[childKey] === true;
            return (
              <div key={childKey} className="space-y-2">
                <button
                  type="button"
                  className={keepGoingQuestionBtnClass}
                  onClick={() => onQuestionRowClick(childKey, fu)}
                >
                  <span className={`min-w-0 flex-1 ${captureBodyCopySizeClass}`}>
                    {fu}
                  </span>
                  {childOpen ? (
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-blue-400 dark:text-blue-400"
                      aria-hidden
                    />
                  ) : (
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-blue-400 dark:text-blue-400"
                      aria-hidden
                    />
                  )}
                </button>
                <AnswerUnderQuestion
                  answerKey={childKey}
                  expanded={childOpen}
                  answersByKey={answersByKey}
                  expandedByKey={expandedByKey}
                  onQuestionRowClick={onQuestionRowClick}
                  nested
                />
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

  if (nested) {
    return (
      <div
        className={`mt-2 rounded-lg border border-zinc-100 bg-zinc-50/90 px-3 py-3 ${captureBodyCopySizeClass} text-zinc-700 shadow-inner dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300`}
      >
        <span className="whitespace-pre-wrap">{answer}</span>
        {keepGoing}
      </div>
    );
  }

  return (
    <div
      className={`ml-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 ${captureBodyCopySizeClass} text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300`}
    >
      <span className="whitespace-pre-wrap">{answer}</span>
      {keepGoing}
    </div>
  );
}

export function CaptureFollowupsPanel({
  captureId,
  presetQuestions,
  enrichSlot,
}: Props) {
  const [answersByKey, setAnswersByKey] = useState<
    Record<string, AnswerEntry>
  >({});
  const [expandedByKey, setExpandedByKey] = useState<Record<string, boolean>>(
    {}
  );
  const [customRows, setCustomRows] = useState<{ id: string; text: string }[]>(
    []
  );
  const [customText, setCustomText] = useState("");
  const [customAskBusy, setCustomAskBusy] = useState(false);

  const postQuestion = useCallback(
    async (question: string): Promise<FollowupStructuredResponse> => {
      const res = await fetch(`/api/captures/${captureId}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = (await res.json()) as {
        answer?: string;
        followUps?: unknown;
        related?: unknown;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      if (typeof data.answer !== "string" || !data.answer.trim()) {
        throw new Error("Empty answer from server");
      }
      const followUps = Array.isArray(data.followUps)
        ? data.followUps
            .map((x) => (typeof x === "string" ? x.trim() : ""))
            .filter(Boolean)
        : [];
      return {
        answer: data.answer.trim(),
        followUps,
        related: [],
      };
    },
    [captureId]
  );

  const askQuestion = useCallback(
    (answerKey: string, questionText: string): Promise<void> => {
      setAnswersByKey((prev) => ({
        ...prev,
        [answerKey]: { loading: true },
      }));

      return (async () => {
        try {
          const data = await postQuestion(questionText);
          setAnswersByKey((prev) => ({
            ...prev,
            [answerKey]: { loading: false, data },
          }));
        } catch (e) {
          const message =
            e instanceof Error ? e.message : "Something went wrong";
          setAnswersByKey((prev) => ({
            ...prev,
            [answerKey]: { loading: false, error: message },
          }));
        }
      })();
    },
    [postQuestion]
  );

  const handleQuestionRowClick = useCallback(
    (answerKey: string, questionText: string) => {
      const wasExpanded = expandedByKey[answerKey] === true;
      const willOpen = !wasExpanded;

      setExpandedByKey((prev) => ({
        ...prev,
        [answerKey]: willOpen,
      }));

      if (!willOpen) return;

      const entry = answersByKey[answerKey];
      if (!entry?.data && !entry?.loading) {
        askQuestion(answerKey, questionText);
      }
    },
    [answersByKey, askQuestion, expandedByKey]
  );

  async function onCustomAsk() {
    const q = customText.trim();
    if (!q || customAskBusy) return;
    setCustomAskBusy(true);
    try {
      const id = crypto.randomUUID();
      const answerKey = `custom/${id}`;
      setCustomRows((prev) => [...prev, { id, text: q }]);
      setExpandedByKey((prev) => ({ ...prev, [answerKey]: true }));
      setCustomText("");
      await askQuestion(answerKey, q);
    } finally {
      setCustomAskBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2.5 border-t border-zinc-200/80 pt-2.5 dark:border-zinc-800 sm:mt-4 sm:space-y-4 sm:pt-4">
      {presetQuestions.length > 0 ? (
        <div>
          <p
            className={`${captureSectionLabelSizeClass} text-zinc-500 dark:text-zinc-500`}
          >
            Follow-up questions
          </p>
          <ul className="mt-2 space-y-2">
            {presetQuestions.map((question, index) => {
              const answerKey = `preset/${index}`;
              const isOpen = expandedByKey[answerKey] === true;
              return (
                <li key={answerKey} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleQuestionRowClick(answerKey, question)}
                    className={followUpQuestionBtnClass}
                  >
                    <span className={`min-w-0 flex-1 ${captureBodyCopySizeClass}`}>
                      {question}
                    </span>
                    {isOpen ? (
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-blue-400 dark:text-blue-400"
                        aria-hidden
                      />
                    ) : (
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-blue-400 dark:text-blue-400"
                        aria-hidden
                      />
                    )}
                  </button>
                  <AnswerUnderQuestion
                    answerKey={answerKey}
                    expanded={isOpen}
                    answersByKey={answersByKey}
                    expandedByKey={expandedByKey}
                    onQuestionRowClick={handleQuestionRowClick}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="space-y-1.5 sm:space-y-2">
        <p
          className={`${captureSectionLabelSizeClass} text-zinc-500 dark:text-zinc-500`}
        >
          Your question
        </p>
        <div className="flex w-full items-center rounded-xl border border-blue-200 bg-white px-3 py-2 shadow-sm transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:border-blue-900/40 dark:bg-zinc-900 dark:focus-within:border-blue-500 dark:focus-within:ring-blue-950/40">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (customAskBusy || !customText.trim()) return;
                void onCustomAsk();
              }
            }}
            placeholder="Ask your own follow-up..."
            className={`min-w-0 flex-1 border-0 bg-transparent py-1 ${captureBodyCopySizeClass} text-blue-700 outline-none placeholder:text-gray-400 dark:text-blue-300 dark:placeholder:text-zinc-500`}
          />
          <button
            type="button"
            disabled={customAskBusy}
            onClick={() => void onCustomAsk()}
            className={`ml-2 shrink-0 ${captureBodyCopySizeClass} font-medium text-blue-600 transition hover:text-blue-700 active:opacity-80 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300`}
          >
            {customAskBusy ? "Asking…" : "Ask"}
          </button>
        </div>
        {enrichSlot ? (
          <div className="mt-1.5 flex justify-center">
            <div className="flex flex-col items-center gap-1">{enrichSlot}</div>
          </div>
        ) : null}
      </div>

      {customRows.length > 0 ? (
        <ul className="space-y-4">
          {customRows.map(({ id, text }) => {
            const answerKey = `custom/${id}`;
            const isOpen = expandedByKey[answerKey] === true;
            return (
              <li key={id} className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleQuestionRowClick(answerKey, text)}
                  className={followUpQuestionBtnClass}
                >
                  <span
                    className={`min-w-0 flex-1 text-left ${captureBodyCopySizeClass}`}
                  >
                    {text}
                  </span>
                  {isOpen ? (
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-blue-400 dark:text-blue-400"
                      aria-hidden
                    />
                  ) : (
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-blue-400 dark:text-blue-400"
                      aria-hidden
                    />
                  )}
                </button>
                <AnswerUnderQuestion
                  answerKey={answerKey}
                  expanded={isOpen}
                  answersByKey={answersByKey}
                  expandedByKey={expandedByKey}
                  onQuestionRowClick={handleQuestionRowClick}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
