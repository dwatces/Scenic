import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.js";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.js"],
      include: ["src/**/*.test.{js,jsx}"],
      // npm run test:coverage: the shared code and the pages.
      coverage: {
        provider: "v8",
        include: [
          "src/shared/**/*.{js,jsx}",
          "src/scenes/**/*.{js,jsx}",
          "src/user/**/*.{js,jsx}",
          "src/landing_page/**/*.{js,jsx}",
        ],
        exclude: ["**/*.test.{js,jsx}", "src/test/**"],
        reporter: ["text", "html", "json-summary"],
        reportsDirectory: "coverage",
        thresholds: { lines: 70 },
      },
    },
  }),
);
