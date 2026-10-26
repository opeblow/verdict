import type { Page } from "@playwright/test";

/** One request the browser made to Verdict's analysis routes, in order. */
export type Call = "analyze" | "poll" | "mask" | "delete";

// A 1x1 transparent PNG stands in for every detection mask.
const MASK_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

const MASK_URL = "https://yce-us.s3-accelerate.amazonaws.com/e2e/mask.png";

/**
 * Answers Verdict's analysis routes inside the browser, so the suite never
 * reaches the server's YouCam client and never spends API units. Responses
 * follow the shapes the real routes return, after normalisation.
 */
export async function mockYouCam(page: Page, { concerns = ["pore", "oiliness", "redness", "moisture"] } = {}) {
  const calls: Call[] = [];
  let tasks = 0;
  let polls = 0;

  await page.route("**/api/analyze", (route) => {
    calls.push("analyze");
    tasks += 1;
    return route.fulfill({ json: { taskId: `e2e-task-${tasks}-000000` } });
  });

  await page.route("**/api/analyze/*", (route) => {
    if (route.request().method() === "DELETE") {
      calls.push("delete");
      return route.fulfill({ status: 204 });
    }
    calls.push("poll");
    polls += 1;
    // First poll of each task reports running, like the live API usually does.
    if (polls % 2 === 1) return route.fulfill({ json: { status: "running" } });
    return route.fulfill({
      json: {
        status: "success",
        analysis: {
          readings: concerns.map((c, i) => ({
            key: c,
            concern: c,
            region: "whole",
            raw: 60 + i * 6 + (polls % 3) * 0.4,
            ui: 72 + i * 3,
            maskUrl: MASK_URL,
          })),
          overall: 74,
          skinAge: 29,
        },
      },
    });
  });

  await page.route("**/api/mask*", (route) => {
    calls.push("mask");
    return route.fulfill({ body: MASK_PNG, contentType: "image/png" });
  });

  return {
    calls,
    count: (c: Call) => calls.filter((x) => x === c).length,
  };
}
