import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "userData";
const SESSION_MS = 60 * 60 * 1000; // tokens from the API last one hour

/**
 * The saved session, or null when there is none, it has expired, or storage
 * can't be read (a private window, blocked site data).
 * @returns {{ userId: string, token: string, expiration: Date } | null}
 */
export function readStoredAuth(now = Date.now()) {
  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
  if (!stored || !stored.token || !stored.userId) return null;
  const expiration = new Date(stored.expiration);
  if (!(expiration.getTime() > now)) return null;
  return { userId: stored.userId, token: stored.token, expiration };
}

export const useAuth = () => {
  // Read synchronously on the first render, so a signed-in visitor who
  // reloads a members-only page (e.g. /scenes/new) stays on it instead of
  // being sent to /login and then /.
  const [session, setSession] = useState(readStoredAuth);
  // True after the session ran out (rather than the visitor logging out),
  // so a members-only page can say why it sent them to log in.
  const [sessionEnded, setSessionEnded] = useState(false);

  const login = useCallback((userId, token, expirationDate) => {
    const expiration = expirationDate || new Date(Date.now() + SESSION_MS);
    setSession({ userId, token, expiration });
    setSessionEnded(false);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ userId, token, expiration: expiration.toISOString() }),
      );
    } catch {
      // Storage unavailable: the session still lasts for this tab.
    }
  }, []);

  const logout = useCallback(({ expired = false } = {}) => {
    setSession(null);
    setSessionEnded(expired === true);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable: nothing was saved to remove.
    }
  }, []);

  // Sign out when the token expires.
  useEffect(() => {
    if (!session) return undefined;
    const timer = setTimeout(
      () => logout({ expired: true }),
      session.expiration.getTime() - Date.now(),
    );
    return () => clearTimeout(timer);
  }, [session, logout]);

  return {
    token: session ? session.token : null,
    userId: session ? session.userId : null,
    sessionEnded,
    login,
    logout,
  };
};
