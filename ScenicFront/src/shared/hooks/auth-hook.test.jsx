import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";

import { useAuth, readStoredAuth } from "./auth-hook";
import App from "../../App";

const HOUR = 60 * 60 * 1000;

function store(session) {
  localStorage.setItem("userData", JSON.stringify(session));
}

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("readStoredAuth", () => {
  it("returns an unexpired session", () => {
    const expiration = new Date(Date.now() + HOUR).toISOString();
    store({ userId: "u1", token: "t1", expiration });
    expect(readStoredAuth()).toEqual({
      userId: "u1",
      token: "t1",
      expiration: new Date(expiration),
    });
  });

  it("ignores an expired, incomplete or unreadable session", () => {
    store({ userId: "u1", token: "t1", expiration: new Date(Date.now() - 1000).toISOString() });
    expect(readStoredAuth()).toBeNull();
    store({ token: "t1", expiration: new Date(Date.now() + HOUR).toISOString() });
    expect(readStoredAuth()).toBeNull();
    localStorage.setItem("userData", "{not json");
    expect(readStoredAuth()).toBeNull();
    localStorage.clear();
    expect(readStoredAuth()).toBeNull();
  });
});

describe("useAuth", () => {
  it("knows the stored session on the very first render", () => {
    store({ userId: "u1", token: "t1", expiration: new Date(Date.now() + HOUR).toISOString() });
    const firstRender = [];
    renderHook(() => {
      const auth = useAuth();
      firstRender.push(auth.token);
      return auth;
    });
    expect(firstRender[0]).toBe("t1");
  });

  it("saves the session on login and clears it on logout", () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.login("u2", "t2"));
    expect(result.current).toMatchObject({ userId: "u2", token: "t2" });
    expect(JSON.parse(localStorage.getItem("userData"))).toMatchObject({
      userId: "u2",
      token: "t2",
    });
    act(() => result.current.logout());
    expect(result.current).toMatchObject({ userId: null, token: null });
    expect(localStorage.getItem("userData")).toBeNull();
  });

  it("signs out when the token expires", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAuth());
    act(() => result.current.login("u3", "t3", new Date(Date.now() + 5000)));
    act(() => vi.advanceTimersByTime(4999));
    expect(result.current.token).toBe("t3");
    act(() => vi.advanceTimersByTime(2));
    expect(result.current.token).toBeNull();
  });
});

describe("reloading a members-only page while signed in", () => {
  it("stays on /scenes/new", async () => {
    store({ userId: "u1", token: "t1", expiration: new Date(Date.now() + HOUR).toISOString() });
    window.history.replaceState(null, "", "/scenes/new");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Add Scene" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/scenes/new");
  });

  it("sends a signed-out visitor to /login", async () => {
    window.history.replaceState(null, "", "/scenes/new");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /login/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });
});
