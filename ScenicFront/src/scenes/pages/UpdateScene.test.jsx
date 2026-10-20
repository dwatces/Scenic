import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import UpdateScene from "./UpdateScene";
import { resetFreshness } from "../../shared/util/api";
import { KIRI, json, mockApi, renderPage, sceneFixture, signedInAs } from "../../test/api-mock";

afterEach(() => {
  vi.restoreAllMocks();
  resetFreshness();
});

const ROUTE = "/scenes/:sceneId/edit";
const edit = (scene) => `/scenes/${scene.id}/edit`;

describe("Edit scene", () => {
  it("fills in the scene, saves the title and description as JSON, and shows the scene", async () => {
    const scene = sceneFixture(1, { title: "Old title", description: "Old description." });
    const calls = mockApi({
      [`GET /scenes/${scene.id}`]: () => json({ scene }),
      [`PATCH /scenes/${scene.id}`]: ({ init }) =>
        json({ scene: { ...scene, ...JSON.parse(init.body) } }),
    });
    renderPage(<UpdateScene />, {
      path: edit(scene),
      route: ROUTE,
      auth: signedInAs(KIRI),
      routes: { "/scenes/:sceneId": <p>Scene page</p> },
    });

    expect(screen.getByRole("status")).toHaveTextContent("Loading scene…");
    const title = await screen.findByLabelText("Title");
    expect(title).toHaveValue("Old title");
    expect(screen.getByLabelText("Description")).toHaveValue("Old description.");
    await waitFor(() => expect(document.title).toBe("Edit Old title · Scenic"));

    await userEvent.clear(title);
    await userEvent.type(title, "New title");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByText("Scene page")).toBeInTheDocument());

    const patch = calls.find((c) => c.method === "PATCH");
    expect(JSON.parse(patch.init.body)).toEqual({
      title: "New title",
      description: "Old description.",
    });
    expect(patch.init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    });
  });

  it("lists what to fix instead of saving an empty title or a short description", async () => {
    const scene = sceneFixture(2);
    const calls = mockApi({ [`GET /scenes/${scene.id}`]: () => json({ scene }) });
    renderPage(<UpdateScene />, { path: edit(scene), route: ROUTE, auth: signedInAs(KIRI) });
    await userEvent.clear(await screen.findByLabelText("Title"));
    await userEvent.clear(screen.getByLabelText("Description"));
    await userEvent.type(screen.getByLabelText("Description"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const summary = screen.getByRole("alert");
    expect(within(summary).getByRole("heading")).toHaveTextContent("Check these and try again");
    expect(within(summary).getByRole("link", { name: "Enter a title" })).toHaveAttribute(
      "href",
      "#title",
    );
    expect(
      within(summary).getByRole("link", { name: "Descriptions need at least 5 characters" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveFocus();
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0);

    // Each item in the summary takes you to its field.
    await userEvent.click(within(summary).getByRole("link", { name: /Descriptions need/ }));
    expect(screen.getByLabelText("Description")).toHaveFocus();
  });

  it("sends anyone but the owner to the scene's public page", async () => {
    const scene = sceneFixture(3);
    mockApi({ [`GET /scenes/${scene.id}`]: () => json({ scene }) });
    renderPage(<UpdateScene />, {
      path: edit(scene),
      route: ROUTE,
      auth: { ...signedInAs(KIRI), userId: "c".repeat(24) },
    });
    expect(await screen.findByTestId("location")).toHaveTextContent(`/scenes/${scene.id}`);
  });

  it("says when the scene doesn't exist", async () => {
    mockApi({
      "GET /scenes/000000000000000000000000": () =>
        json({ message: "We couldn't find that scene." }, 404),
    });
    renderPage(<UpdateScene />, {
      path: "/scenes/000000000000000000000000/edit",
      route: ROUTE,
      auth: signedInAs(KIRI),
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "We couldn't find that scene" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your scenes" })).toHaveAttribute("href", "/");
  });

  it("shows the API's message in a dialog when saving fails, and keeps the edits", async () => {
    const scene = sceneFixture(4);
    mockApi({
      [`GET /scenes/${scene.id}`]: () => json({ scene }),
      [`PATCH /scenes/${scene.id}`]: () =>
        json({ message: "Titles can be at most 100 characters." }, 422),
    });
    renderPage(<UpdateScene />, { path: edit(scene), route: ROUTE, auth: signedInAs(KIRI) });
    await userEvent.type(await screen.findByLabelText("Title"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Titles can be at most 100 characters.",
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Scene 4!");
  });
});
