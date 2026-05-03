/**
 * Shared parsing for POST /api/captures and token-based shortcut ingestion.
 */

function stripUrlTail(u: string): string {
  return u.replace(/[)\].,;:]+$/g, "").trim();
}

/** First http(s) URL in a string (JSON or plain). */
export function firstHttpUrlInString(s: string): string {
  if (!s) return "";
  const strict = s.match(/https?:\/\/[^\s"]+/i);
  if (strict?.[0]) return stripUrlTail(strict[0]);
  const loose = s.match(/https?:\/\/[^"'\s\\]+/i);
  if (loose?.[0]) return stripUrlTail(loose[0]);
  const idx = s.search(/https?:\/\//i);
  if (idx < 0) return "";
  const tail = s.slice(idx);
  const end = tail.search(/[\s"'<>\])},;]/);
  const chunk =
    end > 0 ? tail.slice(0, end) : stripUrlTail(tail.slice(0, 4000));
  return stripUrlTail(chunk);
}

export function pickExistingText(body: Record<string, unknown>): string {
  for (const k of [
    "raw_text",
    "text",
    "title",
    "content",
    "name",
    "shortcutInput",
    "plainText",
  ] as const) {
    const v = body[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export type ParsedCaptureRequest = {
  rawText: string;
  rawBody: Record<string, unknown>;
  parseOk: boolean;
  detectedUrlFromRawBody: string;
  detectedUrlFromParsedString: string;
};

export async function parseCapturePostRequest(
  request: Request
): Promise<ParsedCaptureRequest> {
  const rawText = await request.text();
  let rawBody: Record<string, unknown> = {};
  let parseOk = false;
  try {
    rawBody = JSON.parse(rawText) as Record<string, unknown>;
    parseOk = true;
  } catch {
    rawBody = {};
  }

  const detectedUrlFromRawBody = firstHttpUrlInString(rawText);
  const detectedUrlFromParsedString = parseOk
    ? firstHttpUrlInString(JSON.stringify(rawBody))
    : "";

  if (!parseOk && detectedUrlFromRawBody) {
    rawBody = {
      raw_text: rawText.trim().slice(0, 80_000),
      url: detectedUrlFromRawBody,
      source: "ios_share",
    };
    parseOk = true;
  }

  return {
    rawText,
    rawBody,
    parseOk,
    detectedUrlFromRawBody,
    detectedUrlFromParsedString,
  };
}
