import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function buildIosShareCapturePayload(text: string, urlParam: string) {
  const body: Record<string, string> = {
    source: "ios_share",
    capture_type: urlParam ? "link" : "text",
  };
  if (text) body.raw_text = text;
  if (urlParam) body.url = urlParam;
  return body;
}

async function createCaptureViaApi(origin: string, payload: Record<string, string>) {
  return fetch(`${origin}/api/captures`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const text = reqUrl.searchParams.get("text")?.trim() ?? "";
  const urlParam = reqUrl.searchParams.get("url")?.trim() ?? "";

  if (!text && !urlParam) {
    return NextResponse.redirect(new URL("/", reqUrl.origin));
  }

  const body = buildIosShareCapturePayload(text, urlParam);

  await createCaptureViaApi(reqUrl.origin, body);

  return NextResponse.redirect(new URL("/", reqUrl.origin));
}

export async function POST(request: Request) {
  const reqUrl = new URL(request.url);

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const obj = parsed as { text?: unknown; url?: unknown };
  const text = typeof obj.text === "string" ? obj.text.trim() : "";
  const urlParam = typeof obj.url === "string" ? obj.url.trim() : "";

  if (!text && !urlParam) {
    return NextResponse.json(
      {
        ok: false,
        error: "Provide at least one of text or url.",
      },
      { status: 400 }
    );
  }

  const body = buildIosShareCapturePayload(text, urlParam);
  const res = await createCaptureViaApi(reqUrl.origin, body);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

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
