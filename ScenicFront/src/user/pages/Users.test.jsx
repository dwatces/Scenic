import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Users from "./Users";
import {
  API,
  DEMO_DANIEL,
  KIRI,
  json,
  mockApi,
  renderPage,
  userFixture,
} from "../../test/api-mock";

afterEach(() => vi.restoreAllMocks());

describe("Members page", () => {
  it("lists every member with their scene count, linking to their page", async () => {
    mockApi({
      "GET /users": () => json({ users: [userFixture(KIRI, 1), userFixture(DEMO_DANIEL, 2)] }),
    });
    renderPage(<Users />, { path: "/users" });
    expect(screen.getByRole("status")).toHaveTextContent("Loading members…");
    const kiri = await screen.findByRole("link", { name: /Kiri/ });
    expect(kiri).toHaveAttribute("href", `/${KIRI.id}/scenes`);
    expect(kiri).toHaveTextContent("1 scene");
    await waitFor(() => expect(document.title).toBe("Members · Scenic"));

    const daniel = screen.getByRole("link", { name: /Daniel \(demo\)/ });
    expect(daniel).toHaveTextContent("2 scenes");
    expect(within(daniel).getByText("Demo account")).toBeInTheDocument();
    expect(daniel.querySelector("img")).toHaveAttribute(
      "src",
      `${API}/users/${DEMO_DANIEL.id}/image?v=1`,
    );
    expect(within(kiri).queryByText("Demo account")).not.toBeInTheDocument();
    expect(screen.getByText(/Sample accounts and photos/)).toBeInTheDocument();
  });

  // The members page used to sit behind an error dialog that came back
  // forever; now it is a panel in the page with one "Try again".
  it("shows a plain error panel when the API can't be reached, and Try again loads the list", async () => {
    const calls = mockApi({
      "GET /users": [
        () => Promise.reject(new TypeError("Failed to fetch")),
        () => json({ users: [userFixture(KIRI, 0)] }),
      ],
    });
    renderPage(<Users />, { path: "/users" });
    const panel = await screen.findByRole("alert");
    expect(panel).toHaveTextContent("We couldn't load the members");
    expect(panel).toHaveTextContent(
      "We couldn't reach Scenic. Check your connection and try again.",
    );
    expect(panel).not.toHaveTextContent("Failed to fetch");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(within(panel).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: /Kiri/ })).toHaveTextContent("0 scenes");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(calls).toHaveLength(2);
  });

  it("says so when nobody has signed up, without the demo note", async () => {
    mockApi({ "GET /users": () => json({ users: [] }) });
    renderPage(<Users />, { path: "/users" });
    expect(await screen.findByText("No one has signed up yet.")).toBeInTheDocument();
    expect(screen.queryByText(/Sample accounts and photos/)).not.toBeInTheDocument();
  });
});
