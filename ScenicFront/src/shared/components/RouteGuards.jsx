import { useContext } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router";

import { AuthContext } from "../context/auth-context";
import { loginPathFor } from "../hooks/http-hook";
import { safeNextPath, SESSION_ENDED } from "../util/api";

/**
 * Members-only pages. A signed-out visitor goes to /login?next=<this page>
 * and comes back after logging in; if their session just ran out, the
 * login page says so.
 */
export const RequireAuth = ({ children }) => {
  const auth = useContext(AuthContext);
  const location = useLocation();
  if (auth.isLoggedIn) return children;
  return (
    <Navigate
      to={loginPathFor(location)}
      replace
      state={auth.sessionEnded ? { notice: SESSION_ENDED } : undefined}
    />
  );
};

/**
 * Log in and sign up. Once signed in, the visitor goes to `next` (only a
 * path on this site) or home.
 */
export const GuestOnly = ({ children }) => {
  const auth = useContext(AuthContext);
  const [params] = useSearchParams();
  if (!auth.isLoggedIn) return children;
  return <Navigate to={safeNextPath(params.get("next"))} replace />;
};
