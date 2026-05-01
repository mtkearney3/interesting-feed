import { NextResponse } from "next/server";

function charFromCode(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  if (code >= 0xd800 && code <= 0xdfff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function decodeHtmlEntities(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(/&#x([0-9a-fA-F]+);/gi, (_, h) => charFromCode(Number.parseInt(h, 16)));
  s = s.replace(/&#(\d+);/g, (_, n) => charFromCode(Number.parseInt(n, 10)));
  s = s.replace(/&nbsp;/gi, " ");
  s = s.replace(/&lt;/g, "<");
  s = s.replace(/&gt;/g, ">");
  s = s.replace(/&quot;/g, '"');
  s = s.replace(/&#39;/g, "'");
  s = s.replace(/&amp;/g, "&");
  return s;
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return "";
  return decodeHtmlEntities(m[1]);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown };
    const urlStr = typeof body.url === "string" ? body.url.trim() : "";
    if (!urlStr) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json(
        { error: "Only http(s) URLs are allowed" },
        { status: 400 }
      );
    }

    const res = await fetch(parsed.toString(), {
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "InterestingFeed/1.0 (+title-preview)",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed (${res.status})` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const chunk = html.length > 600_000 ? html.slice(0, 600_000) : html;
    const title = extractTitle(chunk);

    return NextResponse.json({ title });
  } catch {
    return NextResponse.json(
      { error: "Could not fetch or parse URL" },
      { status: 502 }
    );
  }
}
