import React, { useContext, useState } from "react";
import { Link } from "react-router";

import MainHeader from "./MainHeader";
import NavLinks from "./NavLinks";
import SideDrawer from "./SideDrawer";
import { AuthContext } from "../../context/auth-context";
import { useApiResource } from "../../hooks/resource-hook";
import { API_URL } from "../../../config";
import "./MainNavigation.css";

const DRAWER_ID = "main-menu";

const MainNavigation = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const auth = useContext(AuthContext);
  // Who is signed in, for the avatar beside "My scenes". If it can't load,
  // the link just shows no avatar.
  const me = useApiResource(auth.isLoggedIn ? `${API_URL}/users/${auth.userId}` : null);
  const member = me.data ? me.data.user : null;
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <React.Fragment>
      {drawerOpen && (
        <SideDrawer id={DRAWER_ID} onClose={closeDrawer}>
          <nav className="main-navigation__drawer-nav" aria-label="Main">
            <NavLinks member={member} onNavigate={closeDrawer} />
          </nav>
        </SideDrawer>
      )}

      <MainHeader>
        <button
          type="button"
          className="main-navigation__menu-btn"
          aria-label="Menu"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          aria-controls={DRAWER_ID}
          onClick={() => setDrawerOpen(true)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        {/* The logo is a plain link home: each page has its own h1. */}
        <div className="main-navigation__title">
          <Link to="/">Scenic</Link>
        </div>
        <nav className="main-navigation__header-nav" aria-label="Main">
          <NavLinks member={member} />
        </nav>
      </MainHeader>
    </React.Fragment>
  );
};

export default MainNavigation;
