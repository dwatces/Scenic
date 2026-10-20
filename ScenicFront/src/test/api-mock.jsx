// Helpers for page tests: a fake API behind `fetch`, response shapes that
// match the real API's serialisers, and rendering inside a router with an
// auth context.
import { vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

import { AuthContext } from "../shared/context/auth-context";

/** The API base under test (no REACT_APP_BACKEND_URL, not a production build). */
export const API = "http://localhost:5000/api";

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** A response that never arrives, but rejects like fetch when the request is aborted. */
export const never = ({ init }) =>
  new Promise((resolve, reject) => {
    init.signal?.addEventListener("abort", () =>
      reject(new DOMException("The operation was aborted.", "AbortError")),
    );
  });

/**
 * Replace fetch with handlers keyed "METHOD /path" (the path after /api,
 * without the query). A handler gets { method, path, url, init } and returns
 * a Response (or a promise of one); a function value of a list is used once
 * per call, in order. Unstubbed requests answer 500, so a stray request
 * shows up as a failure. Returns the list of calls.
 */
export function mockApi(handlers) {
  const calls = [];
  const used = {};
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input));
    const method = (init.method || "GET").toUpperCase();
    const path = url.pathname.replace(/^\/api/, "");
    const call = { method, path, url, init };
    calls.push(call);
    const key = `${method} ${path}`;
    let handler = handlers[key];
    if (Array.isArray(handler)) {
      const index = used[key] || 0;
      used[key] = index + 1;
      handler = handler[Math.min(index, handler.length - 1)];
    }
    if (!handler) return json({ message: `No stub for ${key}` }, 500);
    return handler(call);
  });
  return calls;
}

const hexId = (n) => n.toString(16).padStart(24, "0");

export const KIRI = { id: hexId(0xa1), name: "Kiri", avatarUrl: null, isDemo: false };
export const DEMO_DANIEL = {
  id: hexId(0xd1),
  name: "Daniel (demo)",
  avatarUrl: `/api/users/${hexId(0xd1)}/image?v=1`,
  isDemo: true,
};

/** A scene as the API serialises it. */
export function sceneFixture(n, { creator = KIRI, ...overrides } = {}) {
  const id = hexId(0x5000 + n);
  return {
    id,
    title: `Scene ${n}`,
    description: `Description of scene ${n}.`,
    address: "Piha, Auckland",
    location: { lat: -36.9541, lng: 174.4706 },
    imageUrl: `/api/scenes/${id}/image?v=1700000000000`,
    imageType: "image/webp",
    createdAt: "2026-10-20T03:00:00.000Z",
    credit: null,
    isDemo: creator.isDemo,
    creator,
    ...overrides,
  };
}

/** A member's public profile as the API serialises it. */
export const userFixture = (creator, sceneCount = 0) => ({ ...creator, sceneCount });

/** Shows where the router ended up, for redirect assertions. */
export function LocationProbe() {
  const location = useLocation();
  return (
    <p data-testid="location">
      {location.pathname}
      {location.search}
    </p>
  );
}

/**
 * Render `element` at `path` inside a MemoryRouter, with `auth` as the auth
 * context (signed out by default). `routes` adds other pages, for
 * navigation; every unknown path renders the LocationProbe.
 */
export function renderPage(element, { path = "/", route = path, auth = {}, routes = {} } = {}) {
  const value = {
    isLoggedIn: false,
    token: null,
    userId: null,
    sessionEnded: false,
    login: vi.fn(),
    logout: vi.fn(),
    ...auth,
  };
  const utils = render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={element} />
          {Object.entries(routes).map(([routePath, routeElement]) => (
            <Route key={routePath} path={routePath} element={routeElement} />
          ))}
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { ...utils, auth: value };
}

/** A signed-in session for `member`. */
export const signedInAs = (member) => ({
  isLoggedIn: true,
  token: "test-token",
  userId: member.id,
});
