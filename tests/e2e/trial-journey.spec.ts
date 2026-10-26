import { expect, test } from "@playwright/test";
import { analysePhoto, startTrial } from "./support/flows";
import { syntheticFace } from "./support/photos";
import { mockYouCam } from "./support/youcam-mock";

test("a full trial: product, two baselines, a check-in, then the verdict page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const youcam = await mockYouCam(page);

  await startTrial(page);
  await expect(page.getByRole("heading", { name: "Two baseline photos." })).toBeVisible();

  await analysePhoto(page, await syntheticFace(page, { seed: 1 }));
  await expect(page.getByRole("heading", { name: /One more/ })).toBeVisible();
  await expect(page.getByText("SD analysis, locked for this trial")).toBeVisible();

  await analysePhoto(page, await syntheticFace(page, { seed: 2 }));
  await page.waitForURL(/\/trials\/[^/]+\?new=1$/);
  await expect(page.getByRole("heading", { name: "Niacinamide 10% serum" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Targets" })).toBeVisible();

  const trialUrl = page.url().split("?")[0]!;
  await page.goto(`${trialUrl}/check-in`);
  await expect(page.getByRole("heading", { name: "Weekly check-in." })).toBeVisible();
  // A same-day check-in is allowed, with a warning that it mostly measures noise.
  await expect(page.getByText(/Your last photo was today/)).toBeVisible();
  await analysePhoto(page, await syntheticFace(page, { seed: 3 }));
  await expect(page.getByRole("heading", { name: "Saved." })).toBeVisible();

  await page.getByRole("link", { name: "See the verdict" }).click();
  await expect(page.getByRole("heading", { name: /Too early to call./ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Photo log" })).toBeVisible();
  const photoLog = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: /Light match/i }) });
  await expect(photoLog.getByRole("row", { name: /Baseline/ })).toHaveCount(2);
  await expect(photoLog.getByRole("row", { name: /Check-in/ })).toHaveCount(1);

  expect(youcam.count("analyze")).toBe(3);
  // Every photo is removed from YouCam, and only after its results were saved.
  await expect.poll(() => youcam.count("delete")).toBe(3);
  const firstDelete = youcam.calls.indexOf("delete");
  const lastMaskBeforeIt = youcam.calls.slice(0, firstDelete).lastIndexOf("mask");
  expect(lastMaskBeforeIt).toBeGreaterThan(-1);

  expect(errors).toEqual([]);
});

test("the dashboard survives a reload, because trials live in IndexedDB", async ({ page }) => {
  await mockYouCam(page);
  await startTrial(page, "Retinol night cream");
  await analysePhoto(page, await syntheticFace(page, { seed: 4 }));
  await expect(page.getByRole("heading", { name: /One more/ })).toBeVisible();
  await analysePhoto(page, await syntheticFace(page, { seed: 5 }));
  await page.waitForURL(/\/trials\/[^/]+\?new=1$/);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Retinol night cream" })).toBeVisible();

  await page.goto("/trials");
  await expect(page.getByText("Retinol night cream")).toBeVisible();
});
