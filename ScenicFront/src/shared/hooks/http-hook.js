import { useState, useCallback, useRef, useEffect, useContext } from "react";
import { useLocation, useNavigate } from "react-router";

import { AuthContext } from "../context/auth-context";
import { apiRequest, isAbort, sentToken, SESSION_ENDED } from "../util/api";

/** Where to send a visitor whose session ended, so they come back afterwards. */
export const loginPathFor = (location) =>
  `/login?next=${encodeURIComponent(location.pathname + location.search)}`;

/**
 * Requests for actions (log in, post, edit, delete). Failures become a
 * plain `error` message; requests still running when the component goes
 * away are cancelled.
 *
 * If a request that carried the session token gets a 401, the session has
 * ended (the token expired or was revoked): the visitor is logged out and
 * sent to /login?next=<this page> with a note, and comes back here after
 * logging in. A 401 for a request without a token (a wrong password) is an
 * ordinary error.
 */
export const useHttpClient = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const active = useRef(new Set());

  // Read through refs, so sendRequest keeps one identity: effects that
  // depend on it would otherwise re-run on every navigation or sign-in.
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const latest = useRef({ auth, navigate, location });
  useEffect(() => {
    latest.current = { auth, navigate, location };
  });

  const sendRequest = useCallback(async (url, method = "GET", body = null, headers = {}) => {
    const controller = new AbortController();
    active.current.add(controller);
    setIsLoading(true);
    try {
      return await apiRequest(url, { method, body, headers, signal: controller.signal });
    } catch (err) {
      if (isAbort(err)) throw err;
      if (err.status === 401 && sentToken(headers)) {
        const { auth: current, navigate: go, location: here } = latest.current;
        err.sessionEnded = true;
        // Both carry the note: the redirect below, and the one RequireAuth
        // makes if this is a members-only page (the logout lands first).
        go(loginPathFor(here), { replace: true, state: { notice: SESSION_ENDED } });
        current.logout({ expired: true });
        throw err;
      }
      setError(err.message);
      throw err;
    } finally {
      active.current.delete(controller);
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    const controllers = active.current;
    return () => {
      controllers.forEach((controller) => controller.abort());
    };
  }, []);

  return { isLoading, error, sendRequest, clearError };
};
