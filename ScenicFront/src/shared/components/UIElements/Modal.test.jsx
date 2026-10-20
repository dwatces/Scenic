import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Modal from "./Modal";
import ErrorModal from "./ErrorModal";

describe("Modal", () => {
  // Regression: like the drawer, the modal's CSSTransition needs a nodeRef
  // on React 19 or opening it throws.
  it("opens with its header, content and footer", () => {
    const modal = (show) => (
      <Modal show={show} header="Map" footer={<button>Close</button>}>
        <p>Body</p>
      </Modal>
    );
    const { rerender } = render(modal(false));
    rerender(modal(true)); // the enter transition is what needed findDOMNode
    expect(screen.getByRole("heading", { name: "Map" })).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("renders nothing while closed", () => {
    render(<Modal show={false} header="Hidden" />);
    expect(screen.queryByRole("heading", { name: "Hidden" })).not.toBeInTheDocument();
  });

  it("shows an error message and clears it", async () => {
    const onClear = vi.fn();
    render(<ErrorModal error="We couldn't find that scene." onClear={onClear} />);
    expect(screen.getByText("We couldn't find that scene.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Okay" }));
    expect(onClear).toHaveBeenCalled();
  });
});
