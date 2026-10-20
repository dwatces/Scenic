import { useContext } from "react";
import { NavLink } from "react-router";
import { AuthContext } from "../../context/auth-context";
import Avatar from "../UIElements/Avatar";
import { apiAsset } from "../../../config";
import "./NavLinks.css";

const activeClass = ({ isActive }) => (isActive ? "active__link" : undefined);

/**
 * @param {{
 *   member?: { name: string, avatarUrl: string | null } | null,
 *   onNavigate?: () => void,
 * }} props `member`: the signed-in member, once loaded; `onNavigate`: called
 *   when a link or Log out is chosen (the drawer closes itself with it)
 */
const NavLinks = ({ member = null, onNavigate }) => {
  const auth = useContext(AuthContext);

  return (
    <ul className="nav-links">
      <li>
        <NavLink className={activeClass} to="/explore" end onClick={onNavigate}>
          Explore
        </NavLink>
      </li>
      <li>
        <NavLink className={activeClass} to="/users" end onClick={onNavigate}>
          Members
        </NavLink>
      </li>
      {auth.isLoggedIn && (
        <li>
          <NavLink className={activeClass} to={`/${auth.userId}/scenes`} onClick={onNavigate}>
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
          <NavLink className={activeClass} to="/scenes/new" onClick={onNavigate}>
            Add scene
          </NavLink>
        </li>
      )}
      {!auth.isLoggedIn && (
        <li>
          <NavLink className={activeClass} to="/login" onClick={onNavigate}>
            Log in
          </NavLink>
        </li>
      )}
      {auth.isLoggedIn && (
        <li>
          <button
            type="button"
            onClick={() => {
              auth.logout();
              if (onNavigate) onNavigate();
            }}
          >
            Log out
          </button>
        </li>
      )}
    </ul>
  );
};

export default NavLinks;
