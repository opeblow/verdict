import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * Browser tests run against a production build. YouCam is mocked inside the
 * browser, and the server gets a placeholder key, so the suite never spends
 * API units, even on a machine whose .env.local holds a real key.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] }, grep: /full trial|too dark/ },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      YOUCAM_API_KEY: "e2e-mocked-no-calls",
      ACCESS_CODE: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
