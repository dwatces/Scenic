import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Input from "../components/FormElements/Input";
import ErrorSummary from "../components/FormElements/ErrorSummary";
import { VALIDATOR_REQUIRE } from "../Util/validators";
import { useForm, useValidatedSubmit } from "./form";

const FIELDS = [{ id: "title", message: "Enter a title" }];

const TinyForm = ({ onValid }) => {
  const [formState, inputHandler] = useForm({ title: { value: "", isValid: false } }, false);
  const { attempted, errors, handleSubmit } = useValidatedSubmit(formState, FIELDS, onValid);
  return (
    <form onSubmit={handleSubmit} noValidate>
      <ErrorSummary errors={errors} />
      <Input
        id="title"
        element="input"
        type="text"
        label="Title"
        hint="What is it?"
        required
        validators={[VALIDATOR_REQUIRE()]}
        errorText="Enter a title"
        onInput={inputHandler}
        showErrors={attempted}
      />
      <button type="submit">Save</button>
    </form>
  );
};

describe("useValidatedSubmit", () => {
  it("lists the errors and focuses the first field instead of submitting", async () => {
    const onValid = vi.fn();
    render(<TinyForm onValid={onValid} />);
    const title = screen.getByLabelText("Title");
    expect(title).toHaveAccessibleDescription("What is it?");
    expect(screen.queryByRole("alert")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onValid).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Check this and try again");
    expect(screen.getByRole("link", { name: "Enter a title" })).toHaveAttribute("href", "#title");
    expect(title).toHaveFocus();
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title).toHaveAccessibleDescription("What is it? Enter a title");

    await userEvent.type(title, "Matiu");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(title).not.toHaveAttribute("aria-invalid");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onValid).toHaveBeenCalledTimes(1);
  });
});
