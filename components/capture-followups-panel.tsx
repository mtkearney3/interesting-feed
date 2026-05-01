"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

type Slot =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; answer: string; expanded: boolean }
  | { kind: "error"; message: string };

type Props = {
  captureId: string;
  presetQuestions: string[];
};

function AnswerBlock({
  children,
  subtle,
}: {
  children: ReactNode;
  subtle?: boolean;
}) {
  return (
    <div
      className={`mt-2 border-l-[3px] border-sky-400/70 pl-3 text-sm leading-relaxed text-zinc-700 dark:border-sky-500/50 dark:text-zinc-300 ${subtle ? "italic text-zinc-500 dark:text-zinc-400" : ""}`}
    >
      {children}
    </div>
  );
}

export function CaptureFollowupsPanel({
  captureId,
  presetQuestions,
}: Props) {
  const [presetSlots, setPresetSlots] = useState<Record<string, Slot>>({});
  const [customText, setCustomText] = useState("");
  const [customSlot, setCustomSlot] = useState<Slot>({ kind: "idle" });
  const lastCustomQuestion = useRef("");

  const presetKey = (index: number) => `p:${index}`;

  const postQuestion = useCallback(
    async (question: string) => {
      const res = await fetch(`/api/captures/${captureId}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      if (typeof data.answer !== "string" || !data.answer.trim()) {
        throw new Error("Empty answer from server");
      }
      return data.answer.trim();
    },
    [captureId]
  );

  async function onPresetClick(index: number, question: string) {
    const key = presetKey(index);
    let shouldFetch = false;

    setPresetSlots((prev) => {
      const cur = prev[key];
      if (cur?.kind === "done") {
        return {
          ...prev,
          [key]: { ...cur, expanded: !cur.expanded },
        };
      }
      if (cur?.kind === "loading") {
        return prev;
      }
      shouldFetch = true;
      return { ...prev, [key]: { kind: "loading" } };
    });

    if (!shouldFetch) return;

    try {
      const answer = await postQuestion(question);
      setPresetSlots((prev) => ({
        ...prev,
        [key]: { kind: "done", answer, expanded: true },
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setPresetSlots((prev) => ({
        ...prev,
        [key]: { kind: "error", message },
      }));
    }
  }

  async function onCustomAsk() {
    const q = customText.trim();
    if (!q) return;

    if (
      customSlot.kind === "done" &&
      q === lastCustomQuestion.current &&
      customSlot.answer
    ) {
      setCustomSlot({
        ...customSlot,
        expanded: !customSlot.expanded,
      });
      return;
    }

    setCustomSlot({ kind: "loading" });
    try {
      const answer = await postQuestion(q);
      lastCustomQuestion.current = q;
      setCustomSlot({ kind: "done", answer, expanded: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setCustomSlot({ kind: "error", message });
    }
  }

  return (
    <div className="mt-4 space-y-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
      {presetQuestions.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Follow-up questions
          </p>
          <ul className="mt-2 space-y-2">
            {presetQuestions.map((question, index) => {
              const key = presetKey(index);
              const slot = presetSlots[key] ?? { kind: "idle" };
              return (
                <li key={key} className="text-sm">
                  <button
                    type="button"
                    onClick={() => void onPresetClick(index, question)}
                    className="w-full rounded-lg border border-zinc-200/90 bg-zinc-50/90 px-3 py-2.5 text-left text-sm font-normal leading-snug text-sky-800 transition-colors hover:border-sky-300/80 hover:bg-sky-50/80 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-sky-200 dark:hover:border-sky-700/50 dark:hover:bg-sky-950/40"
                  >
                    {question}
                  </button>
                  {slot.kind === "loading" ? (
                    <AnswerBlock subtle>Thinking…</AnswerBlock>
                  ) : null}
                  {slot.kind === "error" ? (
                    <AnswerBlock>
                      <span className="text-red-600 dark:text-red-400">
                        {slot.message}
                      </span>
                    </AnswerBlock>
                  ) : null}
                  {slot.kind === "done" && slot.expanded ? (
                    <AnswerBlock>
                      <span className="whitespace-pre-wrap">{slot.answer}</span>
                    </AnswerBlock>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Your question
        </p>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Ask your own follow-up…"
            className="min-h-[44px] w-full min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none ring-sky-500/20 placeholder:text-zinc-500 focus:border-sky-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-sky-600"
          />
          <button
            type="button"
            onClick={() => void onCustomAsk()}
            className="min-h-[44px] w-full shrink-0 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-900 hover:bg-sky-100 dark:border-sky-900/40 dark:bg-sky-950/50 dark:text-sky-100 dark:hover:bg-sky-950/80 sm:w-auto sm:min-h-0 sm:px-5"
          >
            Ask
          </button>
        </div>
        {customSlot.kind === "loading" ? (
          <AnswerBlock subtle>Thinking…</AnswerBlock>
        ) : null}
        {customSlot.kind === "error" ? (
          <AnswerBlock>
            <span className="text-red-600 dark:text-red-400">
              {customSlot.message}
            </span>
          </AnswerBlock>
        ) : null}
        {customSlot.kind === "done" && customSlot.expanded ? (
          <AnswerBlock>
            <span className="whitespace-pre-wrap">{customSlot.answer}</span>
          </AnswerBlock>
        ) : null}
      </div>
    </div>
  );
}
