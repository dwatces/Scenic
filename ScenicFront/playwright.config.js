import { defineConfig, devices } from "@playwright/test";

// Ports stay inside this workspace's range by default; override with env.
const PREVIEW_PORT = Number(process.env.PW_PREVIEW_PORT || 7104);
const API_PORT = Number(process.env.PW_API_PORT || 7105);

export default defineConfig({
  testDir: "./e2e",
  // Budgets have their own config and run (npm run test:perf).
  testIgnore: ["perf/**"],
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PREVIEW_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Locally the system Chrome; CI uses the Chromium that
        // `npx playwright install` provides.
        launchOptions: process.env.CI ? {} : { executablePath: "/usr/bin/google-chrome" },
      },
    },
  ],
  webServer: [
    {
      command: "node e2e/start-api.mjs",
      url: `http://127.0.0.1:${API_PORT}/`,
      reuseExistingServer: false,
      timeout: 90_000,
      env: { PW_API_PORT: String(API_PORT), E2E_FIXTURE: "1" },
    },
    {
      command: `npx vite build && npx vite preview --port ${PREVIEW_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${PREVIEW_PORT}/`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { REACT_APP_BACKEND_URL: `http://127.0.0.1:${API_PORT}/api` },
    },
  ],
});
