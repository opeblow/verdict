import { describe, expect, it } from "vitest";
import { readEnv } from "@/lib/server/env";
import { isAllowedResultUrl, safeEqual } from "@/lib/server/guard";
import { toHit } from "@/lib/server/openBeautyFacts";
import { SlidingWindowLimiter, clientKey } from "@/lib/server/rateLimit";

describe("isAllowedResultUrl (SSRF guard for the mask proxy)", () => {
  it.each([
    "https://yce-us.s3-accelerate.amazonaws.com/demo/x.png",
    "https://yce-us.s3.us-west-2.amazonaws.com/r/x.png",
    "https://s3-us-west-2.amazonaws.com/yce-us/results/hd_pore_whole.jpg",
    "https://plugins-media.makeupar.com/x.jpg",
    "https://d3ss46vukfdtpo.cloudfront.net/static/x.jpg",
  ])("allows %s", (u) => expect(isAllowedResultUrl(u)).toBe(true));

  it.each([
    "http://yce-us.s3-accelerate.amazonaws.com/x.png",
    "https://evil.example.com/x.png",
    "https://s3-us-west-2.amazonaws.com/someone-else/x.png",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/x",
    "https://user:pass@yce-us.s3-accelerate.amazonaws.com/x.png",
    "https://yce-us.s3-accelerate.amazonaws.com:8443/x.png",
    "https://makeupar.com.evil.io/x.png",
    "file:///etc/passwd",
    "not a url",
  ])("refuses %s", (u) => expect(isAllowedResultUrl(u)).toBe(false));
});

describe("safeEqual", () => {
  it("compares strings without short-circuiting", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("SlidingWindowLimiter", () => {
  it("allows up to the limit, then reports when to retry", () => {
    let t = 0;
    const l = new SlidingWindowLimiter(2, 1000, () => t);
    expect(l.take("a").ok).toBe(true);
    expect(l.take("a").ok).toBe(true);
    const third = l.take("a");
    expect(third.ok).toBe(false);
    expect(third.retryAfter).toBe(1);
    expect(l.take("b").ok).toBe(true);
    t = 1001;
    expect(l.take("a").ok).toBe(true);
  });

  it("keys visitors by the first forwarded address", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientKey(new Headers())).toBe("local");
  });
});

describe("readEnv", () => {
  it("applies safe defaults and ignores empty values", () => {
    const e = readEnv({ YOUCAM_API_KEY: "", ACCESS_CODE: "" });
    expect(e.youcamApiKey).toBeUndefined();
    expect(e.accessCode).toBeUndefined();
    expect(e.skinVersion).toBe("v2.0");
    expect(e.ratePerHour).toBe(20);
  });

  it("rejects an unknown API version", () => {
    expect(() => readEnv({ YOUCAM_SKIN_VERSION: "v9" })).toThrow();
  });
});

describe("Open Beauty Facts mapping", () => {
  it("prefers English fields and drops nameless products", () => {
    expect(toHit({ code: "1", product_name: "Sérum", product_name_en: "Serum", brands: "Acme, Acme Labs", ingredients_text: "Aqua, Niacinamide" })).toEqual({
      barcode: "1",
      name: "Serum",
      brand: "Acme",
      imageUrl: undefined,
      ingredientsText: "Aqua, Niacinamide",
    });
    expect(toHit({ code: "2" })).toBeNull();
  });
});
