import { expect, test } from "@playwright/test";

// These requests go to the real route handlers. Each one is rejected before
// the server would contact YouCam, so none of them spends API units.

const jpeg = { name: "face.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) };

function analyzeForm(overrides: Record<string, string | typeof jpeg> = {}) {
  return {
    image: jpeg,
    mode: "sd",
    concerns: JSON.stringify(["pore", "redness"]),
    width: "900",
    height: "1200",
    ...overrides,
  };
}

test("health reports configuration without revealing secrets", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body).toMatchObject({ ok: true, youcamConfigured: true });
  // The placeholder key from playwright.config.ts must not be echoed back.
  expect(JSON.stringify(body)).not.toContain("e2e-mocked-no-calls");
});

test("analysis rejects unsupported image types", async ({ request }) => {
  const res = await request.post("/api/analyze", { multipart: analyzeForm({ image: { ...jpeg, mimeType: "image/gif", name: "a.gif" } }) });
  expect(res.status()).toBe(415);
  expect((await res.json()).error.code).toBe("unsupported_type");
});

test("analysis rejects an HD request below 1080 pixels", async ({ request }) => {
  const res = await request.post("/api/analyze", { multipart: analyzeForm({ mode: "hd" }) });
  expect(res.status()).toBe(422);
  expect((await res.json()).error.code).toBe("error_below_min_image_size");
});

test("analysis rejects unknown concerns", async ({ request }) => {
  const res = await request.post("/api/analyze", { multipart: analyzeForm({ concerns: JSON.stringify(["not_a_concern"]) }) });
  expect(res.status()).toBe(400);
  expect((await res.json()).error.code).toBe("bad_request");
});

test("the mask proxy refuses hosts that are not YouCam's", async ({ request }) => {
  for (const u of ["https://example.com/a.png", "http://169.254.169.254/latest/meta-data", "file:///etc/passwd"]) {
    const res = await request.get(`/api/mask?u=${encodeURIComponent(u)}`);
    expect(res.status(), u).toBe(400);
  }
});

test("task routes reject malformed ids", async ({ request }) => {
  expect((await request.get("/api/analyze/bad!id")).status()).toBe(400);
  expect((await request.delete("/api/analyze/bad!id")).status()).toBe(400);
});
