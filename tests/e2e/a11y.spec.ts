import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "/", name: "landing" },
  { path: "/method", name: "method" },
  { path: "/privacy", name: "privacy" },
  { path: "/trials", name: "trial list" },
  { path: "/trials/new", name: "new trial" },
  { path: "/settings", name: "your data" },
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    for (const { path, name } of PAGES) {
      test(`${name} has no WCAG 2.2 A or AA violations`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
        expect(summary).toEqual([]);
      });
    }
  });
}

test("the new-trial wizard can be completed to the photo step by keyboard alone", async ({ page }) => {
  await page.goto("/trials/new");
  const manual = page.getByRole("tab", { name: "Enter by hand" });
  await manual.focus();
  await page.keyboard.press("Enter");

  await page.getByLabel("Product name").focus();
  await page.keyboard.type("Keyboard serum");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "What should it improve?" })).toBeFocused();

  await page.getByRole("checkbox", { name: /Pores/ }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Continue", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Pick your photo spot." })).toBeFocused();

  await page.getByRole("button", { name: "Continue to baseline photos" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Upload a photo" })).toBeVisible();
});
