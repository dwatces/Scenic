import React, { useContext, useState } from "react";
import { Link } from "react-router";

import MainHeader from "./MainHeader";
import NavLinks from "./NavLinks";
import SideDrawer from "./SideDrawer";
import Backdrop from "../UIElements/Backdrop";
import { AuthContext } from "../../context/auth-context";
import { useApiResource } from "../../hooks/resource-hook";
import { API_URL } from "../../../config";
import "./MainNavigation.css";

const MainNavigation = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const auth = useContext(AuthContext);
  // Who is signed in, for the avatar beside "My scenes". If it can't load,
  // the link just shows no avatar.
  const me = useApiResource(auth.isLoggedIn ? `${API_URL}/users/${auth.userId}` : null);
  const member = me.data ? me.data.user : null;

  const openDrawer = () => {
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  return (
    <React.Fragment>
      {drawerOpen && <Backdrop onClick={closeDrawer} />}
      <SideDrawer show={drawerOpen} onClick={closeDrawer}>
        <nav className="main-navigation__drawer-nav">
          <NavLinks member={member} />
        </nav>
      </SideDrawer>

      <MainHeader>
        <button className="main-navigation__menu-btn" onClick={openDrawer}>
          <span></span>
          <span></span>
          <span></span>
        </button>
        {/* The logo is a plain link home: each page has its own h1. */}
        <div className="main-navigation__title">
          <Link to="/">Scenic</Link>
        </div>
        <nav className="main-navigation__header-nav">
          <NavLinks member={member} />
        </nav>
      </MainHeader>
    </React.Fragment>
  );
};

export default MainNavigation;
