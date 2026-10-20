const { body } = require("express-validator");

/**
 * How sign-up and login normalise an email address before storing or
 * looking it up. These are exactly the defaults of validator 13.7, which
 * express-validator 6.13 applied when every existing account signed up, so
 * stored addresses keep matching (checked against a table of Gmail,
 * Googlemail, Outlook, Hotmail, Yahoo, iCloud and Yandex addresses; see
 * test/email.test.mjs). Pinned explicitly so a future validator release
 * can't change them silently.
 */
const EMAIL_NORMALISATION = Object.freeze({
  all_lowercase: true,
  gmail_lowercase: true,
  gmail_remove_dots: true,
  gmail_remove_subaddress: true,
  gmail_convert_googlemaildotcom: true,
  outlookdotcom_lowercase: true,
  outlookdotcom_remove_subaddress: true,
  yahoo_lowercase: true,
  yahoo_remove_subaddress: true,
  yandex_lowercase: true,
  yandex_convert_yandexru: true,
  icloud_lowercase: true,
  icloud_remove_subaddress: true,
});

/** The email field for sign-up and login: a string, trimmed, normalised, valid. */
const emailField = () =>
  body("email")
    .isString()
    .withMessage("Enter a valid email address.")
    .bail()
    .trim()
    .normalizeEmail(EMAIL_NORMALISATION)
    .isEmail()
    .withMessage("Enter a valid email address.");

module.exports = { EMAIL_NORMALISATION, emailField };
