import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// jsdom has no matchMedia or IntersectionObserver. Tests that care stub
// matchMedia themselves (see Hero.test.jsx); by default nothing matches.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = vi.fn((query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}
if (typeof window.IntersectionObserver !== "function") {
  window.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
}

// The portal targets that index.html provides.
beforeEach(() => {
  for (const id of ["backdrop-hook", "modal-hook", "drawer-hook"]) {
    if (!document.getElementById(id)) {
      const el = document.createElement("div");
      el.id = id;
      document.body.appendChild(el);
    }
  }
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
