import { expect, type Page } from "@playwright/test";
import type { FilePayload } from "./photos";

/** Steps 1 to 3 of the new-trial wizard, using manual product entry. */
export async function startTrial(page: Page, name = "Niacinamide 10% serum") {
  await page.goto("/trials/new");
  await page.getByRole("tab", { name: "Enter by hand" }).click();
  await page.getByLabel("Product name").fill(name);
  await page.getByLabel("Brand").fill("Test brand");
  await page.getByLabel("Ingredients").fill("Aqua, Niacinamide, Zinc PCA, Glycerin");
  await page.getByRole("button", { name: "Use this product" }).click();

  await expect(page.getByRole("heading", { name: "What should it improve?" })).toBeVisible();
  await page.getByLabel("Price").fill("12");
  await page.getByLabel("Weeks per bottle").fill("8");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.getByLabel("Where will you take the photos?").fill("Bathroom, facing the window");
  await page.getByRole("button", { name: "Continue to baseline photos" }).click();
}

/** Uploads a photo into the capture flow and waits for the review step. */
export async function choosePhoto(page: Page, photo: FilePayload) {
  await page.locator('input[type="file"]').setInputFiles(photo);
  await expect(page.getByRole("button", { name: "Analyse this photo" })).toBeVisible();
}

export async function analysePhoto(page: Page, photo: FilePayload) {
  await choosePhoto(page, photo);
  await page.getByRole("button", { name: "Analyse this photo" }).click();
}
