import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import NewScene from "./NewScene";
import { prepareImage, ImagePrepError } from "../../shared/util/prepare-image";
import { resetFreshness } from "../../shared/util/api";
import { KIRI, json, mockApi, renderPage, sceneFixture, signedInAs } from "../../test/api-mock";

// Preparing a photo needs a real browser's decoder (prepare-image.test.js
// covers it with mocks); here it hands back a small WebP straight away.
vi.mock("../../shared/util/prepare-image", async (importOriginal) => ({
  ...(await importOriginal()),
  prepareImage: vi.fn(),
}));

const PREPARED = new File([new Uint8Array([82, 73, 70, 70])], "scene.webp", {
  type: "image/webp",
});

beforeEach(() => {
  vi.mocked(prepareImage).mockReset().mockResolvedValue(PREPARED);
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
  resetFreshness();
});

async function fillIn() {
  await userEvent.type(screen.getByLabelText("Title"), "Kitekite Falls");
  await userEvent.type(
    screen.getByLabelText("Description"),
    "A short walk to a three-tier waterfall.",
  );
  await userEvent.type(screen.getByLabelText("Location"), "Piha, Auckland");
}

describe("Add a scene", () => {
  it("posts the prepared photo with the fields and opens the new scene at once", async () => {
    const created = sceneFixture(1, { title: "Kitekite Falls" });
    const calls = mockApi({ "POST /scenes": () => json({ scene: created }, 201) });
    renderPage(<NewScene />, {
      path: "/scenes/new",
      auth: signedInAs(KIRI),
      routes: { "/scenes/:sceneId": <p>Scene page</p> },
    });
    expect(document.title).toBe("Add a scene · Scenic");

    await fillIn();
    const original = new File(["x"], "IMG_0001.jpg", { type: "image/jpeg" });
    await userEvent.upload(screen.getByLabelText("Choose a photo"), original);
    expect(await screen.findByRole("img", { name: "Preview of your upload" })).toHaveAttribute(
      "src",
      "blob:preview",
    );
    expect(prepareImage).toHaveBeenCalledWith(original);

    await userEvent.click(screen.getByRole("button", { name: "Add scene" }));
    await waitFor(() => expect(screen.getByText("Scene page")).toBeInTheDocument());
    const post = calls.find((c) => c.method === "POST");
    expect(post.init.headers.Authorization).toBe("Bearer test-token");
    const body = post.init.body;
    expect(body.get("title")).toBe("Kitekite Falls");
    expect(body.get("address")).toBe("Piha, Auckland");
    expect(body.get("image")).toBe(PREPARED);
  });

  it("asks for a photo (and the rest) before sending anything", async () => {
    const calls = mockApi({});
    renderPage(<NewScene />, { path: "/scenes/new", auth: signedInAs(KIRI) });
    await userEvent.click(screen.getByRole("button", { name: "Add scene" }));
    const summary = screen.getByRole("alert");
    for (const message of [
      "Enter a title",
      "Choose a photo",
      "Descriptions need at least 5 characters",
      "Enter where you took the photo",
    ]) {
      expect(summary).toHaveTextContent(message);
    }
    expect(calls).toHaveLength(0);
  });

  it("refuses a file it can't use, in the form, and sends nothing", async () => {
    vi.mocked(prepareImage).mockRejectedValueOnce(
      new ImagePrepError("Choose a JPEG, PNG or WebP photo."),
    );
    const calls = mockApi({});
    renderPage(<NewScene />, { path: "/scenes/new", auth: signedInAs(KIRI) });
    await fillIn();
    // The file picker's filter can be switched to "All files", so the
    // form can't rely on `accept` alone.
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(
      screen.getByLabelText("Choose a photo"),
      new File(["GIF89a"], "anim.gif", { type: "image/gif" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a JPEG, PNG or WebP photo.");
    await userEvent.click(screen.getByRole("button", { name: "Add scene" }));
    expect(calls).toHaveLength(0);
  });

  it("shows the geocoder's message when the place can't be found", async () => {
    mockApi({
      "POST /scenes": () =>
        json(
          {
            message:
              "We couldn't find that place. Try a town or place and its region, e.g. Hahei, Coromandel.",
          },
          422,
        ),
    });
    renderPage(<NewScene />, { path: "/scenes/new", auth: signedInAs(KIRI) });
    await fillIn();
    await userEvent.upload(
      screen.getByLabelText("Choose a photo"),
      new File(["x"], "a.jpg", { type: "image/jpeg" }),
    );
    await screen.findByRole("img", { name: "Preview of your upload" });
    await userEvent.click(screen.getByRole("button", { name: "Add scene" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("We couldn't find that place.");
  });
});
