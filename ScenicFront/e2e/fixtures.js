// Shared test fixture: every page only talks to this machine. Requests to
// any other host are aborted and recorded (Google Fonts and the
// OpenStreetMap embed just fail quietly), so a test can never reach a live
// site.
import { test as base, expect } from "@playwright/test";

const LOCAL = new Set(["127.0.0.1", "localhost"]);

export const test = base.extend({
  blockedHosts: async ({ context }, use) => {
    const blocked = [];
    await context.route("**/*", (route) => {
      const { hostname } = new URL(route.request().url());
      if (LOCAL.has(hostname)) return route.continue();
      blocked.push(hostname);
      return route.abort("blockedbyclient");
    });
    await use(blocked);
  },
  // Pages always come with the guard on.
  page: async ({ page, blockedHosts }, use) => {
    void blockedHosts;
    await use(page);
  },
});

export { expect };

export const API_URL = `http://127.0.0.1:${process.env.PW_API_PORT || 7105}/api`;
