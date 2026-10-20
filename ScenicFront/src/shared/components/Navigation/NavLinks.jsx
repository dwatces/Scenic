import { useContext } from "react";
import { NavLink } from "react-router";
import { AuthContext } from "../../context/auth-context";
import "./NavLinks.css";

const NavLinks = () => {
  const auth = useContext(AuthContext);
  const userId = auth.userId;

  return (
    <ul className="nav-links">
      <li>
        <NavLink className={({ isActive }) => (isActive ? "active__link" : undefined)} to="/users" end>
          All Users
        </NavLink>
      </li>
      {auth.isLoggedIn && (
        <li>
          <NavLink className={({ isActive }) => (isActive ? "active__link" : undefined)} to={`/${userId}/scenes`}>
            My Scenes
          </NavLink>
        </li>
      )}
      {auth.isLoggedIn && (
        <li>
          <NavLink className={({ isActive }) => (isActive ? "active__link" : undefined)} to="/scenes/new">
            Add Scene
          </NavLink>
        </li>
      )}
      {!auth.isLoggedIn && (
        <li>
          <NavLink className={({ isActive }) => (isActive ? "active__link" : undefined)} to="/login">
            Login
          </NavLink>
        </li>
      )}
      {auth.isLoggedIn && (
        <li>
          <button onClick={auth.logout}>Logout</button>
        </li>
      )}
    </ul>
  );
};

export default NavLinks;
