// Requests to the Scenic API. Every failure (no connection, a host's timeout
// page, an API error) becomes a short message a visitor can act on; raw text
// such as "Failed to fetch" never reaches the screen.

export const MESSAGES = {
  network: "We couldn't reach Scenic. Check your connection and try again.",
  timeout: "Scenic's server took too long to respond. Please try again.",
  server: "Something went wrong on Scenic's side. Please try again.",
  badRequest: "We couldn't read that request. Please try again.",
  signIn: "Log in to do that.",
  forbidden: "You don't have permission to do that.",
  notFound: "We couldn't find that.",
  tooLarge: "That image is too large. Use one under 3 MB.",
  invalid: "Some details need fixing. Check them and try again.",
  tooMany: "Too many attempts. Wait a few minutes and try again.",
  unavailable: "Scenic is unavailable right now. Please try again shortly.",
};

export const SESSION_ENDED = "Your session has ended. Log in again to carry on.";

/** An API failure with a message that is safe to show, and the HTTP status (0: no response). */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const FALLBACK_BY_STATUS = {
  400: MESSAGES.badRequest,
  401: MESSAGES.signIn,
  403: MESSAGES.forbidden,
  404: MESSAGES.notFound,
  408: MESSAGES.timeout,
  413: MESSAGES.tooLarge,
  422: MESSAGES.invalid,
  429: MESSAGES.tooMany,
  503: MESSAGES.unavailable,
  504: MESSAGES.timeout,
};

/**
 * The message for a failed response. The API's own JSON `message` is
 * written for people, so it wins; anything else (an HTML error page from
 * the host, an empty body) gets a fixed message for its status.
 * @param {number} status
 * @param {unknown} body the parsed JSON body, or null
 */
export function describeFailure(status, body) {
  const message = body && typeof body === "object" ? body.message : null;
  if (typeof message === "string" && message.trim()) return message.trim();
  return FALLBACK_BY_STATUS[status] || (status >= 500 ? MESSAGES.server : MESSAGES.invalid);
}

const isJson = (response) => /\bjson\b/i.test(response.headers.get("content-type") || "");

/** The body as JSON when the response says it is JSON; otherwise (or if it doesn't parse) null. */
async function readJson(response) {
  if (!isJson(response)) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export const isAbort = (err) => Boolean(err) && err.name === "AbortError";

/**
 * Send a request and return the parsed JSON body.
 * @param {string} url
 * @param {{ method?: string, body?: BodyInit | null, headers?: Record<string, string>, signal?: AbortSignal }} [options]
 * @throws {ApiError} with a message safe to show (AbortError passes through untouched)
 */
export async function apiRequest(url, { method = "GET", body = null, headers = {}, signal } = {}) {
  let response;
  try {
    response = await fetch(url, { method, body, headers, signal });
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new ApiError(MESSAGES.network, 0);
  }

  const data = await readJson(response);
  if (!response.ok) throw new ApiError(describeFailure(response.status, data), response.status);
  // A 2xx that isn't JSON means the request reached something other than
  // the API (for example a misconfigured API address serving the app).
  if (data === null) throw new ApiError(MESSAGES.server, response.status);
  return data;
}

/** True when the request carried a session token. */
export const sentToken = (headers = {}) =>
  Object.entries(headers).some(
    ([name, value]) => name.toLowerCase() === "authorization" && /^Bearer\s+\S/i.test(value),
  );

// After a change (a new, edited or deleted scene), list reads add
// ?fresh=<time of the change> for 10 minutes. The CDN may serve a stale read
// for that long while it revalidates, and a new URL skips its cache.
const WRITE_KEY = "scenic:lastWrite";
const FRESH_FOR_MS = 10 * 60 * 1000;
let lastWrite = 0;

function readLastWrite() {
  try {
    return Math.max(lastWrite, Number(sessionStorage.getItem(WRITE_KEY)) || 0);
  } catch {
    return lastWrite;
  }
}

/** Record that this visitor just changed something. */
export function markWrite(now = Date.now()) {
  lastWrite = now;
  try {
    sessionStorage.setItem(WRITE_KEY, String(now));
  } catch {
    // Storage unavailable: the module copy still covers this tab.
  }
}

/** The URL, plus fresh=<time> when this visitor changed something in the last 10 minutes. */
export function withFreshness(url, now = Date.now()) {
  const written = readLastWrite();
  if (!written || now - written > FRESH_FOR_MS) return url;
  return `${url}${url.includes("?") ? "&" : "?"}fresh=${written}`;
}

/** Forget the last write (tests). */
export function resetFreshness() {
  lastWrite = 0;
  try {
    sessionStorage.removeItem(WRITE_KEY);
  } catch {
    // nothing to forget
  }
}

/**
 * A `next` path from the URL, if it is safe to send the visitor to after
 * logging in: a path on this site ("/scenes/new"), never another site
 * ("//example.com", "/\example.com", "https://example.com").
 * @returns {string} the path, or "/" when it isn't safe
 */
export function safeNextPath(next) {
  if (typeof next !== "string" || next.length === 0 || next.length > 2000) return "/";
  if (!next.startsWith("/") || /^\/[/\\]/.test(next)) return "/";
  if (next.includes("://") || next.includes("\\") || /\s/.test(next)) return "/";
  // Control characters: browsers drop some of them from URLs, which could
  // turn "/<tab>/example.com" into "//example.com".
  if ([...next].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f)) {
    return "/";
  }
  return next;
}
