"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { FollowUpOwnQuestionInput } from "@/components/follow-up-own-question-input";
import type { FollowupStructuredResponse } from "@/lib/openai-followup-answer";
import {
  captureBodyCopySizeClass,
  captureSectionLabelSizeClass,
} from "@/lib/capture-ui";

const followUpQuestionBtnClass = `group flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-left ${captureBodyCopySizeClass} font-medium text-blue-700 transition hover:bg-blue-100 active:scale-[0.98] dark:border-blue-900/45 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-950/60`;

const keepGoingQuestionBtnClass = `flex w-full min-w-0 items-center justify-between rounded-xl border border-blue-100 bg-white px-3 py-2 text-left ${captureBodyCopySizeClass} font-medium text-blue-600 transition active:scale-[0.98] dark:border-blue-900/40 dark:bg-zinc-950 dark:text-blue-300`;

type CustomRow = { id: string; text: string; attachAfterKey?: string };

type AnswerEntry = {
  loading: boolean;
  error?: string;
  data?: FollowupStructuredResponse;
};

type TurnKind = "preset" | "suggested" | "custom_base" | "custom_inline";

type ConversationTurn = {
  id: string;
  /** Same shape as legacy answer keys (preset/0, custom/uuid, …) for adjacency helper. */
  pathKey: string;
  depth: number;
  questionText: string;
  kind: TurnKind;
  presetIndex?: number;
  parentTurnId?: string | null;
  /** Parent pathKey for custom_inline (attach target). */
  parentPathKey?: string | null;
  /** Index in parent’s `data.followUps` for suggested follow-ups. */
  suggestionIndex?: number;
  state: AnswerEntry;
};

function turnsToSyntheticCustomRows(turns: ConversationTurn[]): CustomRow[] {
  const rows: CustomRow[] = [];
  for (const t of turns) {
    if (t.kind !== "custom_inline" || !t.parentPathKey) continue;
    const idPart = t.pathKey.startsWith("custom/")
      ? t.pathKey.slice("custom/".length)
      : t.id;
    rows.push({
      id: idPart,
      text: t.questionText,
      attachAfterKey: t.parentPathKey,
    });
  }
  return rows;
}

function isConversationAskAdjacentToBaseSlot(
  lastPathKey: string | null,
  presetCount: number,
  syntheticCustomRows: CustomRow[]
): boolean {
  if (lastPathKey == null || presetCount === 0) return false;

  const lastPresetTopKey = `preset/${presetCount - 1}`;

  if (lastPathKey === lastPresetTopKey) return true;
  if (lastPathKey.startsWith(`${lastPresetTopKey}/`)) return true;

  if (lastPathKey.startsWith("custom/")) {
    const id = lastPathKey.slice("custom/".length);
    const row = syntheticCustomRows.find((r) => r.id === id);
    const p = row?.attachAfterKey;
    if (p == null) return false;
    if (p === lastPresetTopKey) return true;
    if (p.startsWith(`${lastPresetTopKey}/`)) return true;
  }

  return false;
}

const loadingShell = `w-full min-w-0 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 ${captureBodyCopySizeClass} text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200`;

const errorShell = `w-full min-w-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 ${captureBodyCopySizeClass} text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200`;

const answerCardClass = `w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-4 py-3 ${captureBodyCopySizeClass} text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300`;

function findSuggestedChildTurn(
  turns: ConversationTurn[],
  parentId: string,
  suggestionIndex: number
): ConversationTurn | undefined {
  return turns.find(
    (t) =>
      t.kind === "suggested" &&
      t.parentTurnId === parentId &&
      t.suggestionIndex === suggestionIndex
  );
}

function customInlineChildrenFor(
  turns: ConversationTurn[],
  parentId: string
): ConversationTurn[] {
  return turns.filter(
    (t) => t.kind === "custom_inline" && t.parentTurnId === parentId
  );
}

type ResponseBlockProps = {
  turn: ConversationTurn;
  turns: ConversationTurn[];
  openTurns: Record<string, boolean>;
  setOpenTurns: Dispatch<SetStateAction<Record<string, boolean>>>;
  lastCompletedTurnId: string | null;
  showInlineOwnQuestion: boolean;
  inlineAskText: string;
  setInlineAskText: (v: string) => void;
  inlineAskBusy: boolean;
  onInlineCustomAsk: () => void | Promise<void>;
  onSuggestedPick: (
    parent: ConversationTurn,
    text: string,
    suggestionIndex: number
  ) => void;
};

function ResponseBlock({
  turn,
  turns,
  openTurns,
  setOpenTurns,
  lastCompletedTurnId,
  showInlineOwnQuestion,
  inlineAskText,
  setInlineAskText,
  inlineAskBusy,
  onInlineCustomAsk,
  onSuggestedPick,
}: ResponseBlockProps) {
  const { state } = turn;
  const showInlineHere =
    lastCompletedTurnId === turn.id && showInlineOwnQuestion;

  const customInlines = customInlineChildrenFor(turns, turn.id);

  return (
    <div className="w-full min-w-0 space-y-2">
      {state.loading ? (
        <div className={loadingShell}>Thinking…</div>
      ) : null}
      {state.error ? <div className={errorShell}>{state.error}</div> : null}
      {state.data ? (
        <>
          <div className={answerCardClass}>
            <span className="block min-w-0 whitespace-pre-wrap">
              {state.data.answer}
            </span>
          </div>
          {state.data.followUps.length > 0 ? (
            <div className="w-full min-w-0 border-t border-zinc-100 pt-3 dark:border-zinc-700/80">
              <p
                className={`mb-2 ${captureSectionLabelSizeClass} text-zinc-400 dark:text-zinc-500`}
              >
                Keep going
              </p>
              <div className="w-full min-w-0 space-y-2">
                {state.data.followUps.map((fu, idx) => {
                  const child = findSuggestedChildTurn(turns, turn.id, idx);
                  const childOpen = child ? openTurns[child.id] !== false : true;
                  return (
                    <div key={`${turn.id}-fu-${idx}`} className="w-full min-w-0 space-y-2">
                      <button
                        type="button"
                        className={keepGoingQuestionBtnClass}
                        onClick={() => {
                          if (child) {
                            setOpenTurns((prev) => {
                              const cur = prev[child.id] !== false;
                              return { ...prev, [child.id]: !cur };
                            });
                          } else {
                            onSuggestedPick(turn, fu, idx);
                          }
                        }}
                      >
                        <span
                          className={`min-w-0 flex-1 text-left ${captureBodyCopySizeClass}`}
                        >
                          {fu}
                        </span>
                        {child && childOpen ? (
                          <ChevronDown
                            className="h-4 w-4 shrink-0 text-blue-400 opacity-60 dark:text-blue-400"
                            aria-hidden
                          />
                        ) : (
                          <ChevronRight
                            className="h-4 w-4 shrink-0 text-blue-400 opacity-60 dark:text-blue-400"
                            aria-hidden
                          />
                        )}
                      </button>
                      {child != null && childOpen ? (
                        <ResponseBlock
                          turn={child}
                          turns={turns}
                          openTurns={openTurns}
                          setOpenTurns={setOpenTurns}
                          lastCompletedTurnId={lastCompletedTurnId}
                          showInlineOwnQuestion={showInlineOwnQuestion}
                          inlineAskText={inlineAskText}
                          setInlineAskText={setInlineAskText}
                          inlineAskBusy={inlineAskBusy}
                          onInlineCustomAsk={onInlineCustomAsk}
                          onSuggestedPick={onSuggestedPick}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {customInlines.map((ct) => (
            <div key={ct.id} className="w-full min-w-0 space-y-2">
              <button
                type="button"
                onClick={() =>
                  setOpenTurns((prev) => {
                    const cur = prev[ct.id] !== false;
                    return { ...prev, [ct.id]: !cur };
                  })
                }
                className={followUpQuestionBtnClass}
              >
                <span
                  className={`min-w-0 flex-1 text-left ${captureBodyCopySizeClass}`}
                >
                  {ct.questionText}
                </span>
                {openTurns[ct.id] !== false ? (
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
              {openTurns[ct.id] !== false ? (
                <ResponseBlock
                  turn={ct}
                  turns={turns}
                  openTurns={openTurns}
                  setOpenTurns={setOpenTurns}
                  lastCompletedTurnId={lastCompletedTurnId}
                  showInlineOwnQuestion={showInlineOwnQuestion}
                  inlineAskText={inlineAskText}
                  setInlineAskText={setInlineAskText}
                  inlineAskBusy={inlineAskBusy}
                  onInlineCustomAsk={onInlineCustomAsk}
                  onSuggestedPick={onSuggestedPick}
                />
              ) : null}
            </div>
          ))}
          {showInlineHere ? (
            <FollowUpOwnQuestionInput
              className="w-full min-w-0 pt-1"
              value={inlineAskText}
              onChange={setInlineAskText}
              onSubmit={() => void onInlineCustomAsk()}
              busy={inlineAskBusy}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

type Props = {
  captureId: string;
  presetQuestions: string[];
  enrichSlot?: ReactNode;
};

export function CaptureFollowupsPanel({
  captureId,
  presetQuestions,
  enrichSlot,
}: Props) {
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const turnsRef = useRef(turns);
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);
  const [openTurns, setOpenTurns] = useState<Record<string, boolean>>({});
  const [customText, setCustomText] = useState("");
  const [customAskBusy, setCustomAskBusy] = useState(false);
  const [lastCompletedTurnId, setLastCompletedTurnId] = useState<string | null>(
    null
  );
  const [inlineAskText, setInlineAskText] = useState("");
  const [inlineAskBusy, setInlineAskBusy] = useState(false);

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

  const runFetchForTurn = useCallback(
    async (turnId: string, question: string) => {
      try {
        const data = await postQuestion(question);
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId ? { ...t, state: { loading: false, data } } : t
          )
        );
        setLastCompletedTurnId(turnId);
        setInlineAskText("");
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Something went wrong";
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? { ...t, state: { loading: false, error: message } }
              : t
          )
        );
      }
    },
    [postQuestion]
  );

  const presetTurnId = (index: number) => `preset-${index}`;

  const handlePresetClick = useCallback(
    (index: number, questionText: string) => {
      const id = presetTurnId(index);
      const existing = turnsRef.current.find((t) => t.id === id);
      if (existing) {
        setOpenTurns((prev) => {
          const cur = prev[id] !== false;
          return { ...prev, [id]: !cur };
        });
        return;
      }
      const pathKey = `preset/${index}`;
      setTurns((prev) => [
        ...prev,
        {
          id,
          pathKey,
          depth: 0,
          questionText,
          kind: "preset",
          presetIndex: index,
          state: { loading: true },
        },
      ]);
      setOpenTurns((prev) => ({ ...prev, [id]: true }));
      void runFetchForTurn(id, questionText);
    },
    [runFetchForTurn]
  );

  const handleSuggestedPick = useCallback(
    (
      parentTurn: ConversationTurn,
      followUpText: string,
      suggestionIndex: number
    ) => {
      if (
        turnsRef.current.some(
          (t) =>
            t.kind === "suggested" &&
            t.parentTurnId === parentTurn.id &&
            t.suggestionIndex === suggestionIndex
        )
      ) {
        return;
      }
      const newId = crypto.randomUUID();
      const pathKey = `${parentTurn.pathKey}/fu/${newId}`;
      setTurns((prev) => [
        ...prev,
        {
          id: newId,
          pathKey,
          depth: parentTurn.depth + 1,
          questionText: followUpText,
          kind: "suggested",
          parentTurnId: parentTurn.id,
          suggestionIndex,
          state: { loading: true },
        },
      ]);
      setOpenTurns((prev) => ({ ...prev, [newId]: true }));
      void runFetchForTurn(newId, followUpText);
    },
    [runFetchForTurn]
  );

  const onCustomAsk = useCallback(async () => {
    const q = customText.trim();
    if (!q || customAskBusy) return;
    setCustomAskBusy(true);
    try {
      const id = crypto.randomUUID();
      const pathKey = `custom/${id}`;
      setTurns((prev) => [
        ...prev,
        {
          id,
          pathKey,
          depth: 0,
          questionText: q,
          kind: "custom_base",
          state: { loading: true },
        },
      ]);
      setOpenTurns((prev) => ({ ...prev, [id]: true }));
      setCustomText("");
      await runFetchForTurn(id, q);
    } finally {
      setCustomAskBusy(false);
    }
  }, [customAskBusy, customText, runFetchForTurn]);

  const onInlineCustomAsk = useCallback(async () => {
    if (lastCompletedTurnId == null) return;
    const parent = turnsRef.current.find((t) => t.id === lastCompletedTurnId);
    if (!parent) return;
    const q = inlineAskText.trim();
    if (!q || inlineAskBusy) return;
    setInlineAskBusy(true);
    try {
      const id = crypto.randomUUID();
      const pathKey = `custom/${id}`;
      setTurns((prev) => [
        ...prev,
        {
          id,
          pathKey,
          depth: parent.depth + 1,
          questionText: q,
          kind: "custom_inline",
          parentTurnId: parent.id,
          parentPathKey: parent.pathKey,
          state: { loading: true },
        },
      ]);
      setOpenTurns((prev) => ({ ...prev, [id]: true }));
      setInlineAskText("");
      await runFetchForTurn(id, q);
    } finally {
      setInlineAskBusy(false);
    }
  }, [inlineAskBusy, inlineAskText, lastCompletedTurnId, runFetchForTurn]);

  const lastPathKey =
    lastCompletedTurnId == null
      ? null
      : (turns.find((t) => t.id === lastCompletedTurnId)?.pathKey ?? null);

  const showBaseAskInput =
    lastPathKey == null ||
    !isConversationAskAdjacentToBaseSlot(
      lastPathKey,
      presetQuestions.length,
      turnsToSyntheticCustomRows(turns)
    );

  const latestExpanded =
    lastCompletedTurnId != null &&
    openTurns[lastCompletedTurnId] !== false;

  const showFloatingOwnQuestion =
    lastCompletedTurnId != null && !latestExpanded;

  const showInlineOwnQuestion = latestExpanded;

  const customBaseTurns = turns.filter((t) => t.kind === "custom_base");

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
              const tid = presetTurnId(index);
              const presetTurn = turns.find((t) => t.id === tid);
              const hasTurn = presetTurn != null;
              const presetOpen = openTurns[tid] !== false;
              return (
                <li key={tid} className="w-full min-w-0 space-y-2">
                  <button
                    type="button"
                    onClick={() => handlePresetClick(index, question)}
                    className={followUpQuestionBtnClass}
                  >
                    <span className={`min-w-0 flex-1 ${captureBodyCopySizeClass}`}>
                      {question}
                    </span>
                    {hasTurn && presetOpen ? (
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
                  {presetTurn != null && presetOpen ? (
                    <ResponseBlock
                      turn={presetTurn}
                      turns={turns}
                      openTurns={openTurns}
                      setOpenTurns={setOpenTurns}
                      lastCompletedTurnId={lastCompletedTurnId}
                      showInlineOwnQuestion={showInlineOwnQuestion}
                      inlineAskText={inlineAskText}
                      setInlineAskText={setInlineAskText}
                      inlineAskBusy={inlineAskBusy}
                      onInlineCustomAsk={onInlineCustomAsk}
                      onSuggestedPick={handleSuggestedPick}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {showBaseAskInput ? (
        <FollowUpOwnQuestionInput
          value={customText}
          onChange={setCustomText}
          onSubmit={() => void onCustomAsk()}
          busy={customAskBusy}
        />
      ) : null}
      {enrichSlot ? (
        <div className="mt-1.5 flex justify-center">
          <div className="flex flex-col items-center gap-1">{enrichSlot}</div>
        </div>
      ) : null}

      {customBaseTurns.length > 0 ? (
        <div className="w-full min-w-0 space-y-4">
          {customBaseTurns.map((turn) => (
            <div key={turn.id} className="w-full min-w-0 space-y-2">
              <button
                type="button"
                onClick={() =>
                  setOpenTurns((prev) => {
                    const cur = prev[turn.id] !== false;
                    return { ...prev, [turn.id]: !cur };
                  })
                }
                className={followUpQuestionBtnClass}
              >
                <span
                  className={`min-w-0 flex-1 text-left ${captureBodyCopySizeClass}`}
                >
                  {turn.questionText}
                </span>
                {openTurns[turn.id] !== false ? (
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
              {openTurns[turn.id] !== false ? (
                <ResponseBlock
                  turn={turn}
                  turns={turns}
                  openTurns={openTurns}
                  setOpenTurns={setOpenTurns}
                  lastCompletedTurnId={lastCompletedTurnId}
                  showInlineOwnQuestion={showInlineOwnQuestion}
                  inlineAskText={inlineAskText}
                  setInlineAskText={setInlineAskText}
                  inlineAskBusy={inlineAskBusy}
                  onInlineCustomAsk={onInlineCustomAsk}
                  onSuggestedPick={handleSuggestedPick}
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {showFloatingOwnQuestion ? (
        <FollowUpOwnQuestionInput
          className="mt-4 w-full min-w-0"
          value={inlineAskText}
          onChange={setInlineAskText}
          onSubmit={() => void onInlineCustomAsk()}
          busy={inlineAskBusy}
        />
      ) : null}
    </div>
  );
}
