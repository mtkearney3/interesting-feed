import { resolveCaptureInsertFromBody } from "@/lib/capture-insert-resolve";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function buildIosShareCapturePayload(text: string, urlParam: string) {
  const body: Record<string, unknown> = {
    source: "ios_share",
    capture_type: urlParam ? "url" : "text",
  };
  if (text) body.raw_text = text;
  if (urlParam) body.url = urlParam;
  return body;
}

/** True if the JSON might still yield text/URL/image after /api/captures normalization. */
function mightContainCapturePayload(p: Record<string, unknown>): boolean {
  const keys = [
    "url",
    "URL",
    "shareUrl",
    "sharedUrl",
    "inputUrl",
    "inputURL",
    "link",
    "Link",
    "href",
    "plainText",
    "value",
    "input",
    "body",
    "message",
    "raw_text",
    "text",
    "content",
    "shortcutInput",
    "title",
    "items",
    "attachments",
    "image_url",
    "name",
  ] as const;
  for (const k of keys) {
    const v = p[k];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim()) return true;
    if (Array.isArray(v) && v.length > 0) return true;
    if (typeof v === "object") return true;
  }
  return false;
}

async function createCaptureViaApi(
  origin: string,
  payload: Record<string, unknown>
) {
  try {
    return await fetch(`${origin}/api/captures`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("CAPTURE_PROXY_FORWARD_THROW", {
      message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const debugProxy = reqUrl.searchParams.get("debug") === "1";
  const text = reqUrl.searchParams.get("text")?.trim() ?? "";
  const urlParam = reqUrl.searchParams.get("url")?.trim() ?? "";

  if (!text && !urlParam) {
    return NextResponse.redirect(new URL("/", reqUrl.origin));
  }

  const forwarded = buildIosShareCapturePayload(text, urlParam);
  const R = resolveCaptureInsertFromBody(forwarded);

  console.log("CAPTURE_PROXY_INCOMING", {
    method: "GET",
    contentType: "(querystring)",
    rawBodyFirst1000: JSON.stringify({
      text: text.slice(0, 400),
      url: urlParam,
    }).slice(0, 1000),
    parsedKeys: Object.keys(forwarded),
    detectedUrl: R.detectedUrl,
    forwardedPayload: forwarded,
  });

  if (debugProxy) {
    return NextResponse.json({
      ok: true,
      debug: true,
      forwardedPayload: forwarded,
      resolved: R,
    });
  }

  const res = await createCaptureViaApi(reqUrl.origin, forwarded);
  const responseText = await res.text();
  if (!res.ok) {
    console.error("CAPTURE_PROXY_FORWARD_FAILED", {
      method: "GET",
      status: res.status,
      responseBodyFirst1500: responseText.slice(0, 1500),
    });
  }

  if (!res.ok) {
    let errMsg = res.statusText;
    try {
      const j = JSON.parse(responseText) as { error?: string };
      if (typeof j.error === "string") errMsg = j.error;
    } catch {
      /* ignore */
    }
    return NextResponse.json(
      { ok: false, error: errMsg },
      { status: res.status }
    );
  }

  return NextResponse.redirect(new URL("/", reqUrl.origin));
}

export async function POST(request: Request) {
  const reqUrl = new URL(request.url);
  const debugProxy = reqUrl.searchParams.get("debug") === "1";
  const contentType = request.headers.get("content-type") ?? "";
  const method = request.method;

  const rawTxt = await request.text();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawTxt) as Record<string, unknown>;
  } catch {
    console.log("CAPTURE_PROXY_INCOMING", {
      method,
      contentType,
      rawBodyFirst1000: rawTxt.slice(0, 1000),
      parsedKeys: [] as string[],
      detectedUrl: null as string | null,
      forwardedPayload: null as Record<string, unknown> | null,
      jsonParseFailed: true,
    });
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const text =
    typeof parsed.text === "string" ? parsed.text.trim() : "";
  const urlParam =
    typeof parsed.url === "string" ? parsed.url.trim() : "";

  const jsonBlob = JSON.stringify(parsed);
  const jsonMightHaveUrl = /https?:\/\//i.test(jsonBlob);

  const hasTextOrUrl = Boolean(text || urlParam);
  if (
    !hasTextOrUrl &&
    !mightContainCapturePayload(parsed) &&
    !jsonMightHaveUrl
  ) {
    console.log("CAPTURE_PROXY_INCOMING", {
      method,
      contentType,
      rawBodyFirst1000: rawTxt.slice(0, 1000),
      parsedKeys: Object.keys(parsed),
      detectedUrl: null,
      forwardedPayload: null,
      rejected: "empty_payload",
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          "Provide at least one of text, url, or Shortcut fields (shareUrl, items, raw_text, etc.).",
      },
      { status: 400 }
    );
  }

  const forwarded: Record<string, unknown> = { ...parsed };
  if (text) {
    forwarded.text = text;
    const rt = forwarded.raw_text;
    if (typeof rt !== "string" || !rt.trim()) forwarded.raw_text = text;
  }
  if (urlParam) forwarded.url = urlParam;

  if (
    !forwarded.source ||
    (typeof forwarded.source === "string" && !forwarded.source.trim())
  ) {
    forwarded.source = "ios_share";
  }

  if (
    typeof forwarded.capture_type !== "string" ||
    !forwarded.capture_type.trim()
  ) {
    if (urlParam) forwarded.capture_type = "url";
    else if (text) forwarded.capture_type = "text";
  }

  const R = resolveCaptureInsertFromBody(forwarded);

  console.log("CAPTURE_PROXY_INCOMING", {
    method,
    contentType,
    rawBodyFirst1000: rawTxt.slice(0, 1000),
    parsedKeys: Object.keys(parsed),
    detectedUrl: R.detectedUrl,
    forwardedPayload: forwarded,
  });

  if (debugProxy) {
    return NextResponse.json({
      ok: true,
      debug: true,
      forwardedPayload: forwarded,
      resolved: R,
    });
  }

  const res = await createCaptureViaApi(reqUrl.origin, forwarded);
  const responseText = await res.text();

  if (!res.ok) {
    console.error("CAPTURE_PROXY_FORWARD_FAILED", {
      method: "POST",
      status: res.status,
      responseBodyFirst1500: responseText.slice(0, 1500),
    });
  }

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (!res.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          typeof data.error === "string" ? data.error : res.statusText,
      },
      { status: res.status }
    );
  }

  return NextResponse.json({ ok: true, capture: data });
}
