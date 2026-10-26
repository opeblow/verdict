import { expect, test } from "@playwright/test";
import { analysePhoto, startTrial } from "./support/flows";
import { syntheticFace } from "./support/photos";
import { mockYouCam } from "./support/youcam-mock";

test("a failed local save can be retried without paying for a second analysis", async ({ page }) => {
  // Make the first open of Verdict's database fail the way a broken store
  // does: asynchronously, with an error event. "e2e-locked" already exists at
  // a newer version, so opening it at version 1 raises a VersionError.
  await page.goto("/privacy");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open("e2e-locked", 5);
        r.onsuccess = () => {
          r.result.close();
          resolve();
        };
      }),
  );
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    let failed = false;
    IDBFactory.prototype.open = function (name: string, version?: number) {
      if (name === "verdict" && !failed) {
        failed = true;
        return open.call(this, "e2e-locked", 1);
      }
      return open.call(this, name, version);
    };
  });
  const youcam = await mockYouCam(page);

  await startTrial(page);
  await analysePhoto(page, await syntheticFace(page, { seed: 1 }));

  const alert = page.locator(".notice-stop");
  await expect(alert).toContainText("couldn't be saved on this device");
  await expect(alert).toContainText("This won't use more units.");
  // Nothing is deleted from YouCam while the result is still unsaved.
  expect(youcam.count("delete")).toBe(0);

  await page.getByRole("button", { name: "Try saving again" }).click();
  await expect(page.getByRole("heading", { name: /One more/ })).toBeVisible();

  expect(youcam.count("analyze")).toBe(1);
  await expect.poll(() => youcam.count("delete")).toBe(1);
});
