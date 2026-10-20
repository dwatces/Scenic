import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";

import "./PageHeading.css";

/**
 * The page's one h1. After an in-app navigation (a link or a redirect, not
 * the first load, a reload or Back), focus moves here, so a screen reader
 * announces the new page instead of staying silent. ScrollToTop has
 * already put the page at the top, so the h1 is in view.
 */
const PageHeading = ({ children, className = "", ...rest }) => {
  const ref = useRef(null);
  const navigationType = useNavigationType();
  const { key } = useLocation();

  useEffect(() => {
    if (navigationType !== "POP" && ref.current) ref.current.focus();
  }, [key, navigationType]);

  return (
    <h1 ref={ref} tabIndex={-1} className={`page-heading ${className}`.trim()} {...rest}>
      {children}
    </h1>
  );
};

export default PageHeading;
