import { useContext } from "react";
import { NavLink } from "react-router";
import { AuthContext } from "../../context/auth-context";
import Avatar from "../UIElements/Avatar";
import { apiAsset } from "../../../config";
import "./NavLinks.css";

const activeClass = ({ isActive }) => (isActive ? "active__link" : undefined);

/** @param {{ member?: { name: string, avatarUrl: string | null } | null }} props the signed-in member, once loaded */
const NavLinks = ({ member = null }) => {
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
            {member && (
              <Avatar
                src={apiAsset(member.avatarUrl)}
                name={member.name}
                size={26}
                className="nav-links__avatar"
              />
            )}
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
