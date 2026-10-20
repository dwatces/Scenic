import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";

import Login from "./Login";
import Signup from "./SignUp";
import { AuthContext } from "../../shared/context/auth-context";
import { json, mockApi, renderPage } from "../../test/api-mock";

afterEach(() => vi.restoreAllMocks());

const LOGIN_FAILED = "That email and password don't match an account.";

describe("Log in", () => {
  it("sends the email and password as JSON and starts the session", async () => {
    const calls = mockApi({
      "POST /users/login": () => json({ userId: "u1", token: "fresh-token" }),
    });
    const { auth } = renderPage(<Login />, { path: "/login" });
    await waitFor(() => expect(document.title).toBe("Log in · Scenic"));
    await userEvent.type(screen.getByLabelText("Email"), "kiri@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(auth.login).toHaveBeenCalledWith("u1", "fresh-token"));
    expect(JSON.parse(calls[0].init.body)).toEqual({
      email: "kiri@example.com",
      password: "secret123",
    });
    // A login request never carries a token, so a 401 here is not "session ended".
    expect(calls[0].init.headers.Authorization).toBeUndefined();
  });

  it("shows the API's one message for a wrong password, then lets the visitor try again", async () => {
    mockApi({
      "POST /users/login": [
        () => json({ message: LOGIN_FAILED }, 401),
        () => json({ userId: "u1", token: "t" }),
      ],
    });
    const { auth } = renderPage(<Login />, { path: "/login" });
    await userEvent.type(screen.getByLabelText("Email"), "kiri@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-one");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    const dialog = await screen.findByRole("dialog", { name: "Something went wrong" });
    expect(dialog).toHaveTextContent(LOGIN_FAILED);
    expect(auth.logout).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "OK" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(auth.login).toHaveBeenCalledTimes(1));
  });

  it("only asks for a valid email and some password (no length rule on log in)", async () => {
    const calls = mockApi({});
    renderPage(<Login />, { path: "/login" });
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    const summary = screen.getByRole("alert");
    expect(summary).toHaveTextContent("Enter a valid email address");
    expect(summary).toHaveTextContent("Enter your password");
    expect(calls).toHaveLength(0);
  });

  it("says why when a session ended, and keeps next on the sign-up link", () => {
    render(
      <AuthContext.Provider value={{ isLoggedIn: false }}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/login",
              search: "?next=%2Fscenes%2Fnew",
              state: { notice: "Your session has ended. Log in again to carry on." },
            },
          ]}
        >
          <Routes>
            <Route path="/login" element={<Login />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your session has ended. Log in again to carry on.",
    );
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/signup?next=%2Fscenes%2Fnew",
    );
  });
});

describe("Sign up", () => {
  it("signs up without a photo: multipart name, email and password, then the session starts", async () => {
    const calls = mockApi({ "POST /users/signup": () => json({ userId: "u2", token: "t2" }, 201) });
    const { auth } = renderPage(<Signup />, { path: "/signup" });
    await waitFor(() => expect(document.title).toBe("Sign up · Scenic"));
    expect(screen.getByText("Add a profile photo (optional)")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Name"), "Mere");
    await userEvent.type(screen.getByLabelText("Email"), "mere@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => expect(auth.login).toHaveBeenCalledWith("u2", "t2"));
    const body = calls[0].init.body;
    expect(body).toBeInstanceOf(FormData);
    expect(Object.fromEntries(body)).toEqual({
      name: "Mere",
      email: "mere@example.com",
      password: "secret123",
    });
  });

  it("lists every problem, links each to its field, and sends nothing", async () => {
    const calls = mockApi({});
    renderPage(<Signup />, { path: "/signup" });
    await userEvent.type(screen.getByLabelText("Password"), "12345");
    await userEvent.click(screen.getByRole("button", { name: "Sign up" }));
    const summary = screen.getByRole("alert");
    expect(
      within(summary)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual([
      "Enter your name",
      "Enter a valid email address",
      "Passwords need at least 6 characters",
    ]);
    expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    expect(calls).toHaveLength(0);
  });

  it("shows the API's message for an email that is already taken", async () => {
    mockApi({
      "POST /users/signup": () =>
        json({ message: "An account with this email already exists." }, 422),
    });
    renderPage(<Signup />, { path: "/signup?next=%2Fexplore", route: "/signup" });
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fexplore",
    );
    await userEvent.type(screen.getByLabelText("Name"), "Mere");
    await userEvent.type(screen.getByLabelText("Email"), "mere@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "An account with this email already exists.",
    );
  });
});
