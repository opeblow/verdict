import { expect, test } from "@playwright/test";
import { choosePhoto, startTrial } from "./support/flows";
import { syntheticFace } from "./support/photos";
import { mockYouCam } from "./support/youcam-mock";

// The ten tones of the Monk Skin Tone scale (Google, 2022), lightest to darkest.
const MONK = ["#f6ede4", "#f3e7db", "#f7ead0", "#eadaba", "#d7bd96", "#a07e56", "#825c43", "#604134", "#3a312a", "#292420"];

test.describe("the photo checks give every skin tone the same answer in the same light", () => {
  for (const [i, skin] of MONK.entries()) {
    test(`Monk tone ${i + 1}: accepted in good light, blocked in a dark room`, async ({ page }) => {
      const youcam = await mockYouCam(page);
      await startTrial(page);

      await choosePhoto(page, await syntheticFace(page, { skin, light: 1 }));
      await expect(page.getByRole("button", { name: "Analyse this photo" })).toBeEnabled();
      await expect(page.getByText(/Too dark|A little dim|Glare|blurry/)).toHaveCount(0);

      await page.getByRole("button", { name: "Retake" }).click();
      await choosePhoto(page, await syntheticFace(page, { skin, light: 0.25 }));
      await expect(page.getByText("Too dark. Face a window or a bright light.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Analyse this photo" })).toBeDisabled();

      expect(youcam.count("analyze")).toBe(0);
    });
  }
});
