import { useContext } from "react";
import { NavLink } from "react-router";
import { AuthContext } from "../../context/auth-context";
import "./NavLinks.css";

const activeClass = ({ isActive }) => (isActive ? "active__link" : undefined);

const NavLinks = () => {
  const auth = useContext(AuthContext);

  return (
    <ul className="nav-links">
      <li>
        <NavLink className={activeClass} to="/explore" end>
          Explore
        </NavLink>
      </li>
      <li>
        <NavLink className={activeClass} to="/users" end>
          Members
        </NavLink>
      </li>
      {auth.isLoggedIn && (
        <li>
          <NavLink className={activeClass} to={`/${auth.userId}/scenes`}>
            My scenes
          </NavLink>
        </li>
      )}
      {auth.isLoggedIn && (
        <li>
          <NavLink className={activeClass} to="/scenes/new">
            Add scene
          </NavLink>
        </li>
      )}
      {!auth.isLoggedIn && (
        <li>
          <NavLink className={activeClass} to="/login">
            Log in
          </NavLink>
        </li>
      )}
      {auth.isLoggedIn && (
        <li>
          <button type="button" onClick={() => auth.logout()}>
            Log out
          </button>
        </li>
      )}
    </ul>
  );
};

export default NavLinks;
