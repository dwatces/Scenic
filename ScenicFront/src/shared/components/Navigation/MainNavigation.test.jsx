import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import MainNavigation from "./MainNavigation";
import NavLinks from "./NavLinks";
import { AuthContext } from "../../context/auth-context";

const signedIn = { isLoggedIn: true, userId: "u1", token: "t", login() {}, logout() {} };

// The header loads the signed-in member's profile for the avatar.
beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          user: { id: "u1", name: "Aroha", avatarUrl: null, sceneCount: 0, isDemo: false },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );
});
afterEach(() => vi.restoreAllMocks());

describe("NavLinks", () => {
  it("shows Log in when signed out and marks the active link", () => {
    render(
      <MemoryRouter initialEntries={["/users"]}>
        <NavLinks />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Members" })).toHaveClass("active__link");
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/explore");
  });

  it("shows the member links when signed in", () => {
    render(
      <AuthContext.Provider value={signedIn}>
        <MemoryRouter initialEntries={["/u1/scenes"]}>
          <NavLinks />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.getByRole("link", { name: "My scenes" })).toHaveAttribute("href", "/u1/scenes");
    expect(screen.getByRole("link", { name: "My scenes" })).toHaveClass("active__link");
    expect(screen.getByRole("link", { name: "Add scene" })).toHaveAttribute("href", "/scenes/new");
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });
});

describe("MainNavigation", () => {
  // The drawer used to crash on React 19 (react-transition-group needed
  // findDOMNode); it is now a native modal <dialog>.
  it("opens the menu as a dialog and closes it when a link is chosen", async () => {
    render(
      <AuthContext.Provider value={signedIn}>
        <MemoryRouter>
          <MainNavigation />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    const menuButton = screen.getByRole("button", { name: "Menu" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(menuButton);
    const drawer = screen.getByRole("dialog", { name: "Menu" });
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(menuButton).toHaveAttribute("aria-controls", drawer.id);
    expect(drawer.querySelector("nav[aria-label='Main']")).toBeInTheDocument();

    await userEvent.click(within(drawer).getByRole("link", { name: "Explore" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the menu with its Close button", async () => {
    render(
      <MemoryRouter>
        <MainNavigation />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus();
  });

  it("shows the signed-in member's initial beside My scenes once the profile loads", async () => {
    render(
      <AuthContext.Provider value={signedIn}>
        <MemoryRouter>
          <MainNavigation />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    // The initial is decorative: the link's name stays "My scenes".
    const link = screen.getAllByRole("link", { name: "My scenes" })[0];
    await waitFor(() => expect(link.querySelector(".avatar__monogram")).toHaveTextContent("A"));
  });
});
