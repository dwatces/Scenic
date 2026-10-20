import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes, useNavigate } from "react-router";

import ScrollToTop from "./ScrollToTop";
import PageHeading from "../UIElements/PageHeading";

const TOP = { top: 0, left: 0, behavior: "instant" };

/** A page with links and buttons for each kind of navigation. */
const Page = ({ title }) => {
  const navigate = useNavigate();
  return (
    <>
      <PageHeading>{title}</PageHeading>
      <Link to="/scene">Open the scene</Link>
      <button type="button" onClick={() => navigate("/saved", { replace: true })}>
        Save
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
    </>
  );
};

function renderApp() {
  render(
    <MemoryRouter initialEntries={["/edit"]}>
      <ScrollToTop />
      <Routes>
        <Route path="/edit" element={<Page title="Edit scene" />} />
        <Route path="/scene" element={<Page title="The scene" />} />
        <Route path="/saved" element={<Page title="Saved scene" />} />
      </Routes>
    </MemoryRouter>,
  );
}

let scrollTo;
beforeEach(() => {
  scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("ScrollToTop", () => {
  it("leaves the first page where the browser put it", () => {
    renderApp();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Edit scene");
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("opens a page reached by a link at the top, then focuses its heading", async () => {
    const user = userEvent.setup();
    let focusedWhenScrolled = null;
    scrollTo.mockImplementation(() => {
      focusedWhenScrolled = document.activeElement;
    });
    renderApp();
    await user.click(screen.getByRole("link", { name: "Open the scene" }));

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(TOP);
    const heading = screen.getByRole("heading", { level: 1, name: "The scene" });
    expect(heading).toHaveFocus();
    // The scroll came first: the heading wasn't focused yet.
    expect(focusedWhenScrolled).not.toBe(heading);
  });

  it("scrolls to the top after a replace (a form that saves and moves on)", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Saved scene");
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(TOP);
  });

  it("leaves Back alone, so the browser can restore the position", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("link", { name: "Open the scene" }));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Edit scene");
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});
