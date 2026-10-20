import { defineConfig } from "vitest/config";

// The API is CommonJS and keeps module-level state (the mongoose connection,
// the demo-mode connect promise), so every test file runs in its own forked
// process, one file at a time, on fixed ports inside 7103-7109.
export default defineConfig({
  test: {
    include: ["test/**/*.test.mjs"],
    globalSetup: ["./test/global-setup.mjs"],
    setupFiles: ["./test/setup/network-guard.mjs"],
    pool: "forks",
    isolate: true,
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 90000,
  },
});
