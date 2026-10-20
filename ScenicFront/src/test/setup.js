import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

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
