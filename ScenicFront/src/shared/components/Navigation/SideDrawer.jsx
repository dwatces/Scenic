import React, { useRef } from "react";
import ReactDOM from "react-dom";
import { CSSTransition } from "react-transition-group";

import "./SideDrawer.css";

const SideDrawer = (props) => {
  // React 19 has no findDOMNode, so CSSTransition needs the node by ref.
  const nodeRef = useRef(null);
  const content = (
    <CSSTransition
      nodeRef={nodeRef}
      in={props.show}
      timeout={300}
      classNames="slide-in-left"
      unmountOnExit
      mountOnEnter
    >
      <aside ref={nodeRef} className="side-drawer" onClick={props.onClick}>
        {props.children}
      </aside>
    </CSSTransition>
  );
  return ReactDOM.createPortal(content, document.getElementById("drawer-hook"));
};

export default SideDrawer;
