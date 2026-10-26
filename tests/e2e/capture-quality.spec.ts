import { expect, test } from "@playwright/test";
import { choosePhoto, startTrial } from "./support/flows";
import { syntheticFace } from "./support/photos";
import { mockYouCam } from "./support/youcam-mock";

test("a photo that is too dark is blocked before any API units are spent", async ({ page }) => {
  const youcam = await mockYouCam(page);
  await startTrial(page);

  await choosePhoto(page, await syntheticFace(page, { light: 0.3 }));
  await expect(page.getByText("Too dark. Face a window or a bright light.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyse this photo" })).toBeDisabled();

  await page.getByRole("button", { name: "Retake" }).click();
  await choosePhoto(page, await syntheticFace(page, { light: 1 }));
  await expect(page.getByRole("button", { name: "Analyse this photo" })).toBeEnabled();

  expect(youcam.count("analyze")).toBe(0);
});
