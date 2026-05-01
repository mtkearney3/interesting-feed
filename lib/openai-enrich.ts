export type EnrichmentResult = {
  ai_title: string;
  ai_summary: string;
  ai_why_interesting: string;
  ai_category: string;
  ai_insight_score: number;
  ai_followup_questions: string[];
  ai_related_notes: string | null;
};

export type CaptureEnrichInput = {
  raw_text: string | null;
  url: string | null;
  source: string | null;
  user_note: string | null;
  capture_type: string;
  image_url: string | null;
};

function clampScore(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 5;
  return Math.min(10, Math.max(1, Math.round(x)));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean)
    .slice(0, 6);
}

function openAiFetchTimeoutMs(hasImage: boolean): number {
  const n = Number(process.env.OPENAI_FETCH_TIMEOUT_MS);
  const base = Number.isFinite(n) && n > 5_000 ? n : 48_000;
  return hasImage ? Math.max(base, 90_000) : base;
}

export async function enrichCaptureWithOpenAI(
  capture: CaptureEnrichInput,
  options?: { signal?: AbortSignal }
): Promise<EnrichmentResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const hasImage = Boolean(capture.image_url?.trim());
  const fetchSignal =
    options?.signal ??
    AbortSignal.timeout(openAiFetchTimeoutMs(hasImage));

  const userPayload = {
    raw_text: capture.raw_text,
    url: capture.url,
    source: capture.source,
    user_note: capture.user_note,
    capture_type: capture.capture_type,
    has_image: hasImage,
  };

  const userText = JSON.stringify(userPayload);

  const visionHint = hasImage
    ? " When an image is attached, ai_summary must describe what appears in the image (visible text, UI, people, charts, etc.) and connect it to raw_text, the URL, and any user note. Be concrete about the screenshot."
    : "";

  const systemContent =
    "You enrich user captures for a personal reading feed. " +
    "Respond with a single JSON object only. Keys (all required except ai_related_notes may be empty string): " +
    "ai_title (short headline), ai_summary (2-4 sentences), ai_why_interesting (1-2 sentences), " +
    "ai_category (short label like science, business, tools, culture), " +
    "ai_insight_score (number 1-10 for how thought-provoking or useful it is), " +
    "ai_followup_questions (array of 2-4 concise questions the reader might explore next), " +
    "ai_related_notes (optional brief connections to themes or caveats; string). " +
    "Be specific to the provided content; avoid generic filler." +
    visionHint;

  const userMessage = hasImage
    ? {
        role: "user" as const,
        content: [
          { type: "text" as const, text: userText },
          {
            type: "image_url" as const,
            image_url: {
              url: capture.image_url!.trim(),
              detail: "high" as const,
            },
          },
        ],
      }
    : {
        role: "user" as const,
        content: userText,
      };

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
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemContent,
        },
        userMessage,
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI returned no message content");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }

  const title = typeof parsed.ai_title === "string" ? parsed.ai_title.trim() : "";
  const summary =
    typeof parsed.ai_summary === "string" ? parsed.ai_summary.trim() : "";
  const why =
    typeof parsed.ai_why_interesting === "string"
      ? parsed.ai_why_interesting.trim()
      : "";
  const category =
    typeof parsed.ai_category === "string" ? parsed.ai_category.trim() : "";
  const related =
    typeof parsed.ai_related_notes === "string"
      ? parsed.ai_related_notes.trim()
      : "";

  if (!title || !summary) {
    throw new Error("OpenAI JSON missing ai_title or ai_summary");
  }

  return {
    ai_title: title,
    ai_summary: summary,
    ai_why_interesting: why || summary.slice(0, 200),
    ai_category: category || "general",
    ai_insight_score: clampScore(parsed.ai_insight_score),
    ai_followup_questions: asStringArray(parsed.ai_followup_questions),
    ai_related_notes: related || null,
  };
}
