import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

import { useHttpClient } from "./http-hook";
import { AuthContext } from "../context/auth-context";

const unauthorised = () =>
  new Response(JSON.stringify({ message: "Your session has expired. Sign in again." }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });

function Poster({ headers }) {
  const { sendRequest, error } = useHttpClient();
  return (
    <>
      <button onClick={() => sendRequest("/api/scenes", "POST", null, headers).catch(() => {})}>
        Post
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}

function LoginProbe() {
  const location = useLocation();
  return (
    <p data-testid="login">
      {location.pathname + location.search} | {location.state && location.state.notice}
    </p>
  );
}

function renderAt(path, { headers, logout = vi.fn() } = {}) {
  render(
    <AuthContext.Provider value={{ isLoggedIn: true, userId: "u1", token: "t", logout }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/scenes/new" element={<Poster headers={headers} />} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { logout };
}

afterEach(() => vi.restoreAllMocks());

describe("useHttpClient", () => {
  it("ends the session on a 401 for a request that sent the token", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => unauthorised());
    const { logout } = renderAt("/scenes/new?draft=1", { headers: { Authorization: "Bearer t" } });
    await userEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(screen.getByTestId("login")).toBeInTheDocument());
    expect(screen.getByTestId("login")).toHaveTextContent(
      "/login?next=%2Fscenes%2Fnew%3Fdraft%3D1 | Your session has ended. Log in again to carry on.",
    );
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("treats a 401 without a token (a wrong password) as an ordinary error", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => unauthorised());
    const { logout } = renderAt("/scenes/new", { headers: { "Content-Type": "application/json" } });
    await userEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your session has expired. Sign in again.",
    );
    expect(logout).not.toHaveBeenCalled();
  });
});
