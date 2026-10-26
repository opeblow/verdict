import { expect, test, type Page } from "@playwright/test";
import { analysePhoto, choosePhoto, startTrial } from "./support/flows";
import { syntheticFace } from "./support/photos";
import { mockYouCam } from "./support/youcam-mock";

/** Replaces the browser's voice with a recorder, so the test can read what would be said. */
async function recordSpeech(page: Page) {
  await page.addInitScript(() => {
    const said: string[] = [];
    (window as unknown as { __said: string[] }).__said = said;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak: (u: SpeechSynthesisUtterance) => said.push(u.text),
        cancel: () => {},
        pause: () => {},
        resume: () => {},
        getVoices: () => [],
        speaking: false,
        pending: false,
        paused: false,
      },
    });
  });
  return () => page.evaluate(() => (window as unknown as { __said: string[] }).__said.slice());
}

test("spoken guidance reads the photo checks, progress and verdict aloud", async ({ page }) => {
  const said = await recordSpeech(page);
  await mockYouCam(page);
  await startTrial(page, "Spoken serum");

  const toggle = page.getByRole("button", { name: "Speak guidance" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await choosePhoto(page, await syntheticFace(page, { light: 0.25 }));
  await expect.poll(said).toContain("Too dark. Face a window or a bright light. Retake the photo.");

  await page.getByRole("button", { name: "Retake" }).click();
  await choosePhoto(page, await syntheticFace(page, { seed: 1 }));
  await expect.poll(said).toContain("Photo looks good. Choose Analyse this photo.");

  await page.getByRole("button", { name: "Analyse this photo" }).click();
  await expect.poll(said).toContain("Results saved.");

  // The setting is remembered on this device for the next photo.
  await expect(page.getByRole("button", { name: "Speak guidance" })).toHaveAttribute("aria-pressed", "true");
  await analysePhoto(page, await syntheticFace(page, { seed: 2 }));
  await page.waitForURL(/\/trials\/[^/]+\?new=1$/);

  await page.getByRole("button", { name: "Read the verdict aloud" }).click();
  await expect.poll(async () => (await said()).at(-1) ?? "").toMatch(/^Spoken serum\. Week 0\. Verdict: Baseline set\./);
  const verdict = (await said()).at(-1)!;
  expect(verdict).toContain("Next check-in");
  expect(verdict).not.toMatch(/[+±]|--/);
});

test("guidance stays silent until it is turned on", async ({ page }) => {
  const said = await recordSpeech(page);
  await mockYouCam(page);
  await startTrial(page);
  await choosePhoto(page, await syntheticFace(page, { light: 0.25 }));
  await page.waitForTimeout(600);
  expect(await said()).toEqual([]);
});
