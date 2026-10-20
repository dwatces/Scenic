import { Link } from "react-router";

/** Beside the log-in and sign-up forms on wide screens: what Scenic is for. */
const AuthIntro = () => (
  <div className="auth-intro">
    <p className="auth-intro__lead">Share the places you love.</p>
    <p>
      Post a photo, say where you took it, and Scenic puts it on a map. Your scenes get a page you
      can share, and you can browse everyone else&apos;s.
    </p>
    <p>
      <Link to="/explore" className="auth-intro__link">
        Browse scenes first
      </Link>
    </p>
  </div>
);

export default AuthIntro;
