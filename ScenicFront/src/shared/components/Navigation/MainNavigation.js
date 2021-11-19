import React, { useState, useContext } from "react";
import { NavLink } from "react-router-dom";

import MainHeader from "./MainHeader";
import NavLinks from "./NavLinks";
import SideDrawer from "./SideDrawer";
import Backdrop from "../UIElements/Backdrop";
import { AuthContext } from "../../context/auth-context";
import "./MainNavagation.css";

const MainNavigation = (props) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const auth = useContext(AuthContext);

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
          <NavLinks />
        </nav>
      </SideDrawer>

      <MainHeader>
        <button className="main-navigation__menu-btn" onClick={openDrawer}>
          <span></span>
          <span></span>
          <span></span>
        </button>
        <h1 className="main-navigation__title">
          {!auth.isLoggedIn && <NavLink to="/">Scenic</NavLink>}
          {auth.isLoggedIn && (
            <NavLink activeClassName="active__link" to="/landing">
              Scenic
            </NavLink>
          )}
        </h1>
        <nav className="main-navigation__header-nav">
          <NavLinks />
        </nav>
      </MainHeader>
    </React.Fragment>
  );
};

export default MainNavigation;
