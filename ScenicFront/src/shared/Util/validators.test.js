import { describe, it, expect } from "vitest";
import { validate, VALIDATOR_MINLENGTH, VALIDATOR_EMAIL, VALIDATOR_REQUIRE } from "./validators";

describe("validators", () => {
  it("checks minimum length, email and required", () => {
    expect(validate("abc", [VALIDATOR_MINLENGTH(5)])).toBe(false);
    expect(validate("abcde", [VALIDATOR_MINLENGTH(5)])).toBe(true);
    expect(validate("a@b.co", [VALIDATOR_EMAIL()])).toBe(true);
    expect(validate("not-an-email", [VALIDATOR_EMAIL()])).toBe(false);
    expect(validate("", [VALIDATOR_REQUIRE()])).toBe(false);
  });
});
