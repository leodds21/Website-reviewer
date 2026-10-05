import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;

/**
 * End-to-end tests drive the production build in a real browser. The
 * analysis endpoint is mocked per test (see e2e/fixtures.ts), so they
 * cover the UI flow deterministically, without PageSpeed quota or
 * third-party sites in the loop; lib/ and the route have their own
 * unit tests for the analysis itself.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // A narrow phone, where layout problems show first.
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } } },
  ],
  webServer: {
    // CI builds in its own step just before; locally, build first.
    command: process.env.CI ? `npx next start -p ${PORT}` : `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
