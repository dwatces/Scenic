import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import MainNavigation from "./MainNavigation";
import NavLinks from "./NavLinks";
import { AuthContext } from "../../context/auth-context";

const signedIn = { isLoggedIn: true, userId: "u1", token: "t", login() {}, logout() {} };

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
  // Regression: React 19 removed findDOMNode, which react-transition-group
  // falls back to without a nodeRef. The first drawer open used to blank
  // the whole app.
  it("opens the side drawer without crashing", async () => {
    render(
      <AuthContext.Provider value={signedIn}>
        <MemoryRouter>
          <MainNavigation />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    await userEvent.click(document.querySelector(".main-navigation__menu-btn"));
    expect(document.querySelector(".side-drawer")).toBeInTheDocument();
    expect(document.querySelector(".side-drawer nav")).toBeInTheDocument();
  });
});
