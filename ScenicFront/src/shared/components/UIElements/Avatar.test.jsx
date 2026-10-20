import { describe, it, expect } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import Avatar, { initialOf } from "./Avatar";

describe("Avatar", () => {
  it("shows the image when there is one", () => {
    const { container } = render(<Avatar src="https://api.example/u/1/image?v=1" name="Aroha" />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://api.example/u/1/image?v=1",
    );
    expect(container.querySelector(".avatar__monogram")).toBeNull();
  });

  it("shows the initial when there is no image", () => {
    const { container } = render(<Avatar src={null} name="kiri" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".avatar__monogram")).toHaveTextContent("K");
    expect(container.querySelector(".avatar__monogram")).toHaveAttribute("aria-hidden", "true");
  });

  it("falls back to the initial when the image fails to load", () => {
    const { container } = render(<Avatar src="https://api.example/broken" name="Daniel" />);
    fireEvent.error(container.querySelector("img"));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".avatar__monogram")).toHaveTextContent("D");
  });

  it("can stand alone with a label", () => {
    const { getByRole } = render(<Avatar src={null} name="Moana" alt="Moana" />);
    expect(getByRole("img", { name: "Moana" })).toHaveTextContent("M");
  });
});

describe("initialOf", () => {
  it("takes the first letter, whatever the script", () => {
    expect(initialOf("  ōtautahi")).toBe("Ō");
    expect(initialOf("")).toBe("?");
    expect(initialOf(null)).toBe("?");
  });
});
