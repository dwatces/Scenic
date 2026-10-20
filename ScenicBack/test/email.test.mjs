// Email normalisation must match what express-validator 6.13 (validator
// 13.7) stored at sign-up, or existing members can't log in.
import { describe, it, expect } from "vitest";
import { require } from "./helpers.mjs";

const { emailField } = require("../util/email.js");

// Outputs recorded once from express-validator 6.13.0 + validator 13.7.0
// (the versions in the old lockfile) running the old sign-up chain,
// check("email").normalizeEmail().isEmail(), in a throwaway install.
const STORED_BY_V6 = {
  "Test.User+123@Gmail.com": "testuser@gmail.com",
  "test.user@gmail.com": "testuser@gmail.com",
  "TestUser@googlemail.com": "testuser@gmail.com",
  "T.e.s.t@GoogleMail.com": "test@gmail.com",
  "First.Last+news@Outlook.com": "first.last@outlook.com",
  "First.Last@Hotmail.co.nz": "first.last@hotmail.co.nz",
  "Someone+x@Hotmail.com": "someone@hotmail.com",
  "name.surname@live.com": "name.surname@live.com",
  "Mixed.Case@Example.CO.NZ": "mixed.case@example.co.nz",
  "a.b+c@yahoo.com": "a.b+c@yahoo.com",
  "a.b-c@Yahoo.com": "a.b@yahoo.com",
  "user+tag@icloud.com": "user@icloud.com",
  "User.Name@me.com": "user.name@me.com",
  "foo+bar@protonmail.com": "foo+bar@protonmail.com",
  "Daniel@Scenic.Example": "daniel@scenic.example",
  "aroha@scenic.example": "aroha@scenic.example",
  "plain@example.com": "plain@example.com",
  "x@Yandex.ru": "x@yandex.ru",
  "x@Yandex.com": "x@yandex.ru",
  "x@ya.ru": "x@yandex.ru",
  "Someone@Windowslive.com": "someone@windowslive.com",
  "Name+tag@Msn.com": "name@msn.com",
};

async function normalise(email) {
  const req = { body: { email } };
  await emailField().run(req);
  return req.body.email;
}

describe("email normalisation", () => {
  it.each(Object.entries(STORED_BY_V6))(
    "%s → %s, as stored by the old API",
    async (typed, stored) => {
      expect(await normalise(typed)).toBe(stored);
    },
  );

  it("is idempotent, so a stored address normalises to itself", async () => {
    for (const stored of Object.values(STORED_BY_V6)) {
      expect(await normalise(stored)).toBe(stored);
    }
  });

  it("trims surrounding spaces", async () => {
    expect(await normalise("  plain@example.com ")).toBe("plain@example.com");
  });
});
