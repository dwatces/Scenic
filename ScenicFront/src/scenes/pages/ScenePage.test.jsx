import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";

import ScenePage, { imageAlt } from "./ScenePage";
import { resetFreshness } from "../../shared/util/api";
import { AuthContext } from "../../shared/context/auth-context";
import {
  API,
  DEMO_DANIEL,
  KIRI,
  json,
  mockApi,
  renderPage,
  sceneFixture,
  signedInAs,
} from "../../test/api-mock";

afterEach(() => {
  vi.restoreAllMocks();
  resetFreshness();
});

const ROUTE = "/scenes/:sceneId";
const at = (scene) => `/scenes/${scene.id}`;

describe("Scene page", () => {
  it("shows the photo, the place, who posted it and when, and a map", async () => {
    const scene = sceneFixture(1, { title: "Lion Rock", address: "Piha, Auckland" });
    const calls = mockApi({ [`GET /scenes/${scene.id}`]: () => json({ scene }) });
    renderPage(<ScenePage />, { path: at(scene), route: ROUTE });

    expect(screen.getByRole("status")).toHaveTextContent("Loading scene…");
    expect(await screen.findByRole("heading", { level: 1, name: "Lion Rock" })).toBeVisible();
    expect(document.title).toBe("Lion Rock · Scenic");
    expect(calls).toHaveLength(1);

    const photo = screen.getByRole("img", { name: "Lion Rock, Piha, Auckland" });
    expect(photo).toHaveAttribute("src", `${API}/scenes/${scene.id}/image?v=1700000000000`);
    expect(photo).toHaveAttribute("width", "1200");
    expect(photo).toHaveAttribute("height", "800");

    expect(screen.getByText(/Posted by/)).toHaveTextContent("Posted by Kiri on 20 October 2026");
    expect(screen.getByRole("link", { name: "Kiri" })).toHaveAttribute(
      "href",
      `/${KIRI.id}/scenes`,
    );

    // The map is an OpenStreetMap embed centred on the scene; nothing else loads it.
    const map = screen.getByTitle("Map of Piha, Auckland");
    expect(map.tagName).toBe("IFRAME");
    const src = new URL(map.getAttribute("src"));
    expect(src.origin + src.pathname).toBe("https://www.openstreetmap.org/export/embed.html");
    expect(src.searchParams.get("marker")).toBe("-36.9541,174.4706");
    expect(map).toHaveAttribute("loading", "lazy");
    expect(screen.getByRole("link", { name: "Open in OpenStreetMap" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/?mlat=-36.9541&mlon=174.4706#map=15/-36.9541/174.4706",
    );
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("describes a demo photo as a placeholder and labels the scene", async () => {
    const scene = sceneFixture(2, { title: "Milford Sound", creator: DEMO_DANIEL });
    mockApi({ [`GET /scenes/${scene.id}`]: () => json({ scene }) });
    renderPage(<ScenePage />, { path: at(scene), route: ROUTE });
    expect(
      await screen.findByRole("img", {
        name: "Placeholder image for Milford Sound (demo content)",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Demo scene")).toBeInTheDocument();
    expect(imageAlt({ ...scene, isDemo: false })).toBe("Milford Sound, Piha, Auckland");
  });

  it("shows a photo credit when the scene has one", async () => {
    const scene = sceneFixture(3, {
      credit: { text: "A. Photographer", url: "https://example.com/a" },
    });
    mockApi({ [`GET /scenes/${scene.id}`]: () => json({ scene }) });
    renderPage(<ScenePage />, { path: at(scene), route: ROUTE });
    expect(await screen.findByRole("link", { name: "A. Photographer" })).toHaveAttribute(
      "href",
      "https://example.com/a",
    );
  });

  it("uses the scene handed over after posting instead of fetching it again", async () => {
    const scene = sceneFixture(4, { title: "Just posted" });
    const calls = mockApi({});
    render(
      <AuthContext.Provider value={{ isLoggedIn: false }}>
        <MemoryRouter initialEntries={[{ pathname: at(scene), state: { scene } }]}>
          <Routes>
            <Route path={ROUTE} element={<ScenePage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Just posted" })).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("says when a scene doesn't exist, with somewhere to go", async () => {
    mockApi({
      "GET /scenes/000000000000000000000000": () =>
        json({ message: "We couldn't find that scene." }, 404),
    });
    renderPage(<ScenePage />, { path: "/scenes/000000000000000000000000", route: ROUTE });
    expect(
      await screen.findByRole("heading", { level: 1, name: "We couldn't find that scene" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("Scene not found · Scenic");
    expect(screen.getByRole("link", { name: "Explore scenes" })).toHaveAttribute(
      "href",
      "/explore",
    );
  });

  it("shows an error panel with Try again when the scene can't load", async () => {
    const scene = sceneFixture(5, { title: "Second time lucky" });
    mockApi({
      [`GET /scenes/${scene.id}`]: [
        () => json({ message: "Something went wrong. Please try again." }, 500),
        () => json({ scene }),
      ],
    });
    renderPage(<ScenePage />, { path: at(scene), route: ROUTE });
    const panel = await screen.findByRole("alert");
    expect(panel).toHaveTextContent("We couldn't load this scene");
    await userEvent.click(within(panel).getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Second time lucky" }),
    ).toBeVisible();
  });

  it("lets the owner edit, or delete after a confirmation that names the scene", async () => {
    const scene = sceneFixture(6, { title: "Muriwai gannets" });
    const calls = mockApi({
      [`GET /scenes/${scene.id}`]: () => json({ scene }),
      [`DELETE /scenes/${scene.id}`]: () => json({ message: "Deleted scene." }),
    });
    renderPage(<ScenePage />, {
      path: at(scene),
      route: ROUTE,
      auth: signedInAs(KIRI),
      routes: { "/": <p>Home page</p> },
    });
    expect(await screen.findByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      `/scenes/${scene.id}/edit`,
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete “Muriwai gannets”?" });
    expect(dialog).toHaveTextContent("This can't be undone.");

    // "Keep it" closes the dialog and sends nothing.
    await userEvent.click(within(dialog).getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete scene" }));
    await waitFor(() => expect(screen.getByText("Home page")).toBeInTheDocument());
    const del = calls.find((c) => c.method === "DELETE");
    expect(del.init.headers.Authorization).toBe("Bearer test-token");
  });

  it("shows the API's message in a dialog when a delete fails, and stays", async () => {
    const scene = sceneFixture(7);
    mockApi({
      [`GET /scenes/${scene.id}`]: () => json({ scene }),
      [`DELETE /scenes/${scene.id}`]: () =>
        json({ message: "You can only change your own scenes." }, 403),
    });
    renderPage(<ScenePage />, { path: at(scene), route: ROUTE, auth: signedInAs(KIRI) });
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete scene" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "You can only change your own scenes.",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Scene 7" })).toBeInTheDocument();
  });
});
