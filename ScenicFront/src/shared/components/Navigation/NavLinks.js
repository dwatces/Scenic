import React, { useContext } from "react";
import { NavLink } from "react-router-dom";
import { AuthContext } from "../../context/auth-context";
import "./NavLinks.css";

const NavLinks = () => {
  const auth = useContext(AuthContext);
  const userId = auth.userId;

  return (
    <ul className="nav-links">
      <li>
        <NavLink activeClassName="active__link" to="/users" exact>
          All Users
        </NavLink>
      </li>
      {auth.isLoggedIn && (
        <li>
          <NavLink activeClassName="active__link" to={`/${userId}/scenes`}>
            My Scenes
          </NavLink>
        </li>
      )}
      {auth.isLoggedIn && (
        <li>
          <NavLink activeClassName="active__link" to="/scenes/new">
            Add Scene
          </NavLink>
        </li>
      )}
      {!auth.isLoggedIn && (
        <li>
          <NavLink activeClassName="active__link" to="/login">
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
