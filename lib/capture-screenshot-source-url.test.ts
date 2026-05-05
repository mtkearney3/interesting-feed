import { describe, expect, it } from "vitest";
import { screenshotSourceLinkFromCapture } from "@/lib/capture-screenshot-source-url";

describe("screenshotSourceLinkFromCapture", () => {
  it("returns hostname label for screenshot + https url", () => {
    expect(
      screenshotSourceLinkFromCapture({
        capture_type: "screenshot",
        url: "https://www.example.com/path?q=1",
      })
    ).toEqual({ href: "https://www.example.com/path?q=1", label: "example.com" });
  });

  it("returns null for url capture type without user storage image", () => {
    expect(
      screenshotSourceLinkFromCapture({
        capture_type: "url",
        url: "https://example.com",
      })
    ).toBeNull();
  });

  it("shows reference link when url row has user supabase screenshot + article url", () => {
    expect(
      screenshotSourceLinkFromCapture({
        capture_type: "url",
        url: "https://x.com/foo",
        image_url:
          "https://abcdef.supabase.co/storage/v1/object/public/captures/u.png",
      })
    ).toEqual({ href: "https://x.com/foo", label: "x.com" });
  });

  it("returns null for invalid url", () => {
    expect(
      screenshotSourceLinkFromCapture({
        capture_type: "screenshot",
        url: "not a url",
      })
    ).toBeNull();
  });

  it("accepts capture_type image", () => {
    expect(
      screenshotSourceLinkFromCapture({
        capture_type: "image",
        url: "https://x.com/foo",
      })
    ).toEqual({ href: "https://x.com/foo", label: "x.com" });
  });
});
