import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;
const FAKE_UPSTASH_PORT = 3299;

// The analysis endpoint is mocked per test (e2e/fixtures.ts).
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
  webServer: [
    {
      // Shared reports are read from Redis on the server, so tests seed this.
      command: `node e2e/fakeUpstash.mjs ${FAKE_UPSTASH_PORT}`,
      url: `http://localhost:${FAKE_UPSTASH_PORT}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Needs a build first; CI builds in its own step.
      command: process.env.CI ? `npx next start -p ${PORT}` : `npm run build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: { UPSTASH_REDIS_REST_URL: `http://localhost:${FAKE_UPSTASH_PORT}`, UPSTASH_REDIS_REST_TOKEN: "e2e" },
    },
  ],
});
