import { describe, expect, it } from "vitest";
import { getCaptureKind, isExternalArticleUrl, isStorageImageUrl } from "@/lib/capture-kind";

const substantiveText = "a".repeat(120);

describe("isStorageImageUrl / isExternalArticleUrl", () => {
  it("treats Supabase storage paths as storage images", () => {
    expect(
      isStorageImageUrl(
        "https://abc.supabase.co/storage/v1/object/public/capture-images/x.png"
      )
    ).toBe(true);
    expect(isExternalArticleUrl("https://abc.supabase.co/storage/v1/object/public/x.png")).toBe(
      false
    );
  });
});

describe("getCaptureKind", () => {
  it("screenshot with image_url only → IMAGE_VISION", () => {
    const img =
      "https://abc.supabase.co/storage/v1/object/public/capture-images/clip.png";
    const k = getCaptureKind({
      capture_type: "screenshot",
      image_url: img,
      url: "",
      raw_text: "hi",
    });
    expect(k.kind).toBe("image");
    expect(k.pipeline).toBe("IMAGE_VISION");
    expect(k.useOpenAiVision).toBe(true);
    expect(k.articleUrl).toBeNull();
  });

  it("screenshot with image_url + Supabase url (duplicate) → IMAGE_VISION", () => {
    const img =
      "https://abc.supabase.co/storage/v1/object/public/capture-images/clip.png";
    const k = getCaptureKind({
      capture_type: "screenshot",
      image_url: img,
      url: img,
      raw_text: "",
    });
    expect(k.kind).toBe("image");
    expect(k.pipeline).toBe("IMAGE_VISION");
  });

  it("URL article with CNN URL + preview image → URL_ARTICLE_TEXT_ONLY", () => {
    const k = getCaptureKind({
      capture_type: "url",
      url: "https://www.cnn.com/2024/example-article",
      image_url: "https://cdn.cnn.com/cnnnext/dam/assets/preview.jpg",
      raw_text: "",
    });
    expect(k.kind).toBe("url");
    expect(k.pipeline).toBe("URL_ARTICLE_TEXT_ONLY");
    expect(k.articleUrl).toBe("https://www.cnn.com/2024/example-article");
  });

  it("text clip with article URL + CDN preview without file extension → URL_ARTICLE_TEXT_ONLY", () => {
    const k = getCaptureKind({
      capture_type: "text",
      url: "https://www.theguardian.com/world/2024/example",
      image_url: "https://assets.guim.co.uk/images/foo-id/master/500",
      raw_text: "Interesting read",
    });
    expect(k.kind).toBe("url");
    expect(k.pipeline).toBe("URL_ARTICLE_TEXT_ONLY");
  });

  it("manual URL article (link-style) → URL_ARTICLE_TEXT_ONLY", () => {
    const k = getCaptureKind({
      capture_type: "link",
      url: "https://www.reuters.com/world/article",
      image_url: null,
      raw_text: "saved from browser",
    });
    expect(k.kind).toBe("url");
    expect(k.pipeline).toBe("URL_ARTICLE_TEXT_ONLY");
  });

  it("text only → TEXT_ONLY", () => {
    const k = getCaptureKind({
      capture_type: "text",
      url: "",
      image_url: null,
      raw_text: substantiveText,
    });
    expect(k.kind).toBe("text");
    expect(k.pipeline).toBe("TEXT_ONLY");
  });

  it("Supabase PNG in url field with image_url → IMAGE_VISION, not URL_ARTICLE_TEXT_ONLY", () => {
    const png =
      "https://abc.supabase.co/storage/v1/object/public/capture-images/uuid.png";
    const k = getCaptureKind({
      capture_type: "screenshot",
      url: png,
      image_url: png,
      raw_text: "",
    });
    expect(k.kind).toBe("image");
    expect(k.pipeline).toBe("IMAGE_VISION");
    expect(k.pipeline).not.toBe("URL_ARTICLE_TEXT_ONLY");
  });

  it("article URL + storage screenshot + substantive notes → IMAGE_SCREENSHOT_TEXT_PRIMARY (no forced vision)", () => {
    const img =
      "https://abc.supabase.co/storage/v1/object/public/capture-images/clip.png";
    const k = getCaptureKind({
      capture_type: "link",
      url: "https://www.cnn.com/2024/story",
      image_url: img,
      raw_text: substantiveText + " real notes without storage urls",
    });
    expect(k.kind).toBe("image");
    expect(k.pipeline).toBe("IMAGE_SCREENSHOT_TEXT_PRIMARY");
    expect(k.useOpenAiVision).toBe(false);
  });
});
