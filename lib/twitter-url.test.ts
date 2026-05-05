import { describe, expect, it } from "vitest";
import { isTwitterOrXArticleUrl } from "@/lib/twitter-url";

describe("isTwitterOrXArticleUrl", () => {
  it("detects x.com and twitter.com", () => {
    expect(isTwitterOrXArticleUrl("https://x.com/user/status/123")).toBe(true);
    expect(
      isTwitterOrXArticleUrl("https://twitter.com/user/status/123")
    ).toBe(true);
    expect(isTwitterOrXArticleUrl("https://mobile.twitter.com/i/flow")).toBe(
      true
    );
    expect(isTwitterOrXArticleUrl("https://www.cnn.com/2024/a")).toBe(false);
  });
});
