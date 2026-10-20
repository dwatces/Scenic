import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

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
// jsdom has <dialog> but not showModal() or close(): enough of both for
// the components (open flag, the close event).
if (typeof HTMLDialogElement.prototype.showModal !== "function") {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
// jsdom's window.scrollTo only reports "Not implemented". A no-op keeps
// the output clean; tests that care spy on it (see ScrollToTop.test.jsx).
window.scrollTo = () => {};
if (typeof window.IntersectionObserver !== "function") {
  window.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
