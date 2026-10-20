// Performance and payload budgets (npm run test:perf), kept apart from the
// end-to-end run because throttled timings are noisy on a busy machine.
// Its own ports (7102 API, 7106 preview, 7109 MongoDB), so it never clashes
// with test:e2e (7104, 7105, 7108); both build into build/, so run them one
// after the other.
import { defineConfig, devices } from "@playwright/test";

const PREVIEW_PORT = Number(process.env.PERF_PREVIEW_PORT || 7106);
const API_PORT = Number(process.env.PERF_API_PORT || 7102);
const DB_PORT = Number(process.env.PERF_DB_PORT || 7109);
// e2e/fixtures.js reads the API address from PW_API_PORT.
process.env.PW_API_PORT = String(API_PORT);

export default defineConfig({
  testDir: "./e2e/perf",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 120_000,
  reporter: [["list"]],
  outputDir: "test-results/perf",
  use: {
    baseURL: `http://127.0.0.1:${PREVIEW_PORT}`,
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
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
      env: { PW_API_PORT: String(API_PORT), PW_DB_PORT: String(DB_PORT), E2E_FIXTURE: "1" },
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
