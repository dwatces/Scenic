import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";

import SceneGrid from "./SceneGrid";
import { API, DEMO_DANIEL, KIRI, renderPage, sceneFixture } from "../../test/api-mock";

const cards = () => screen.getAllByRole("listitem");

describe("SceneGrid and SceneCard", () => {
  it("shows each photo from the API's origin at a fixed 3:2 size, lazily, as decoration", () => {
    const scenes = [sceneFixture(1), sceneFixture(2)];
    renderPage(<SceneGrid scenes={scenes} />);
    expect(cards()).toHaveLength(2);
    const img = cards()[0].querySelector(".scene-card__image img");
    expect(img).toHaveAttribute("src", `${API}/scenes/${scenes[0].id}/image?v=1700000000000`);
    expect(img).toHaveAttribute("width", "600");
    expect(img).toHaveAttribute("height", "400");
    expect(img).toHaveAttribute("loading", "lazy");
    // The title link right under the photo names the card.
    expect(img).toHaveAttribute("alt", "");
  });

  it("links the title to the scene page, at the heading level asked for", () => {
    const scene = sceneFixture(3, { title: "Karekare Falls" });
    renderPage(<SceneGrid scenes={[scene]} headingLevel={3} />);
    const heading = screen.getByRole("heading", { level: 3, name: "Karekare Falls" });
    expect(within(heading).getByRole("link")).toHaveAttribute("href", `/scenes/${scene.id}`);
    expect(screen.getByText("Piha, Auckland")).toBeInTheDocument();
  });

  it("labels demo scenes, and only those", () => {
    renderPage(<SceneGrid scenes={[sceneFixture(1, { creator: DEMO_DANIEL }), sceneFixture(2)]} />);
    const [demo, real] = cards();
    expect(within(demo).getByText("Demo scene")).toBeInTheDocument();
    expect(within(real).queryByText("Demo scene")).not.toBeInTheDocument();
  });

  it("shows the creator with their avatar, or their initial when they have none", () => {
    renderPage(<SceneGrid scenes={[sceneFixture(1, { creator: DEMO_DANIEL }), sceneFixture(2)]} />);
    const [withAvatar, withoutAvatar] = cards();
    expect(within(withAvatar).getByRole("link", { name: "Daniel" })).toHaveAttribute(
      "href",
      `/${DEMO_DANIEL.id}/scenes`,
    );
    expect(withAvatar.querySelector(".avatar img")).toHaveAttribute(
      "src",
      `${API}/users/${DEMO_DANIEL.id}/image?v=1`,
    );
    expect(withoutAvatar.querySelector(".avatar img")).toBeNull();
    expect(withoutAvatar.querySelector(".avatar__monogram")).toHaveTextContent("K");
  });

  it("hides the creator on a member's own page", () => {
    renderPage(<SceneGrid scenes={[sceneFixture(1)]} showCreator={false} />);
    expect(screen.queryByRole("link", { name: "Kiri" })).not.toBeInTheDocument();
  });

  it("gives Edit and Delete to the owner's cards only", () => {
    const other = { ...KIRI, id: "b".repeat(24), name: "Tama" };
    const scenes = [sceneFixture(1), sceneFixture(2, { creator: other })];
    renderPage(<SceneGrid scenes={scenes} ownerId={KIRI.id} onDeleted={() => {}} />);
    const [mine, theirs] = cards();
    expect(within(mine).getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      `/scenes/${scenes[0].id}/edit`,
    );
    expect(within(mine).getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(within(theirs).queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(within(theirs).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("gives nobody Edit or Delete when signed out", () => {
    renderPage(<SceneGrid scenes={[sceneFixture(1)]} />);
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});
