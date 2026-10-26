import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { analysePhoto, startTrial } from "./support/flows";
import { syntheticFace } from "./support/photos";
import { mockYouCam } from "./support/youcam-mock";

test("a result can be shared as review text and as a card, without the photo", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await mockYouCam(page);
  await startTrial(page, "Share serum");
  await analysePhoto(page, await syntheticFace(page, { seed: 1 }));
  await expect(page.getByRole("heading", { name: /One more/ })).toBeVisible();
  await analysePhoto(page, await syntheticFace(page, { seed: 2 }));
  await page.waitForURL(/\/trials\/[^/]+\?new=1$/);

  // Sharing appears once there is something beyond the baseline.
  await expect(page.getByRole("heading", { name: "Share your result" })).toHaveCount(0);
  await page.goto(`${page.url().split("?")[0]}/check-in`);
  await analysePhoto(page, await syntheticFace(page, { seed: 3 }));
  await page.getByRole("link", { name: "See the verdict" }).click();
  await expect(page.getByRole("heading", { name: "Share your result" })).toBeVisible();

  const review = page.getByLabel("Review text");
  await expect(review).toContainText("Measured result: Share serum");
  await expect(review).toContainText("not a medical assessment");

  await page.getByRole("button", { name: "Copy review text" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Copied" })).toBeVisible();
  // Windows' clipboard stores line breaks as CRLF.
  const copied = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
  expect(copied).toBe((await review.innerText()).replace(/\r\n/g, "\n"));

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download result card" }).click()]);
  expect(download.suggestedFilename()).toBe("verdict-share-serum.png");
  await download.saveAs(test.info().outputPath("result-card.png"));
  const png = await readFile((await download.path())!);
  expect(png.subarray(1, 4).toString("latin1")).toBe("PNG");
  // IHDR width and height.
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1350);

  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});
