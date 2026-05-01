export type FollowupCaptureContext = {
  raw_text: string | null;
  url: string | null;
  image_url: string | null;
  ai_title: string | null;
  ai_summary: string | null;
  ai_why_interesting: string | null;
  ai_category: string | null;
  ai_related_notes: string | null;
};

function followupFetchTimeoutMs(hasImage: boolean): number {
  const n = Number(process.env.OPENAI_FETCH_TIMEOUT_MS);
  const base = Number.isFinite(n) && n > 5_000 ? n : 48_000;
  return hasImage ? Math.max(base, 90_000) : base;
}

export async function answerFollowupQuestion(
  ctx: FollowupCaptureContext,
  question: string,
  options?: { signal?: AbortSignal }
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const hasImage = Boolean(ctx.image_url?.trim());
  const fetchSignal =
    options?.signal ??
    AbortSignal.timeout(followupFetchTimeoutMs(hasImage));

  const contextJson = JSON.stringify({
    raw_text: ctx.raw_text,
    url: ctx.url,
    image_url: ctx.image_url,
    ai_title: ctx.ai_title,
    ai_summary: ctx.ai_summary,
    ai_why_interesting: ctx.ai_why_interesting,
    ai_category: ctx.ai_category,
    ai_related_notes: ctx.ai_related_notes,
  });

  const userText =
    `You are answering a follow-up about this capture (JSON context):\n${contextJson}\n\n` +
    `Question:\n${question}\n\n` +
    `Answer clearly and practically in plain language. Short paragraphs are fine. Do not repeat the JSON.`;

  const system =
    "You help the user explore a saved capture. Answer only the question, using the context (and image if present). Be accurate and useful.";

  const userMessage = hasImage
    ? {
        role: "user" as const,
        content: [
          { type: "text" as const, text: userText },
          {
            type: "image_url" as const,
            image_url: {
              url: ctx.image_url!.trim(),
              detail: "high" as const,
            },
          },
        ],
      }
    : { role: "user" as const, content: userText };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: fetchSignal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 900,
      messages: [
        { role: "system", content: system },
        userMessage,
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenAI returned no answer text");
  }

  return text;
}
