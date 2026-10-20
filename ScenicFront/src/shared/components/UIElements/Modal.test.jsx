import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Modal from "./Modal";
import ErrorModal from "./ErrorModal";

describe("Modal", () => {
  it("opens as a dialog labelled by its heading", () => {
    const modal = (show) => (
      <Modal show={show} header="Delete “Milford Sound”?" footer={<button>Keep it</button>}>
        <p>Body</p>
      </Modal>
    );
    const { rerender } = render(modal(false));
    rerender(modal(true));
    const dialog = screen.getByRole("dialog", { name: "Delete “Milford Sound”?" });
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep it" })).toBeInTheDocument();
    // No second banner landmark inside the dialog.
    expect(dialog.querySelector("header")).toBeNull();
  });

  it("renders nothing while closed", () => {
    render(<Modal show={false} header="Hidden" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks to close on Escape and on a backdrop click, not on a click inside", () => {
    const onCancel = vi.fn();
    render(
      <Modal show header="Map" onCancel={onCancel}>
        <p>Inside</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(screen.getByText("Inside"));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(dialog);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("gives focus back to the button that opened it", async () => {
    const Harness = () => {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <Modal
            show={open}
            header="Dialog"
            onCancel={() => setOpen(false)}
            footer={<button onClick={() => setOpen(false)}>Close</button>}
          />
        </>
      );
    };
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("shows an error message and clears it", async () => {
    const onClear = vi.fn();
    render(<ErrorModal error="We couldn't find that scene." onClear={onClear} />);
    expect(screen.getByRole("dialog", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText("We couldn't find that scene.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onClear).toHaveBeenCalled();
  });
});
