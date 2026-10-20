import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router";

/**
 * Opens each new page at the top, which the browser only does on a full page
 * load. PUSH and REPLACE scroll to the top; Back and Forward (POP) are left
 * to the browser's own scroll restoration.
 *
 * A layout effect, so it runs before paint and before PageHeading focuses the
 * new h1. "instant" overrides the smooth scrolling set on <html>.
 */
const ScrollToTop = () => {
  const { key } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType !== "POP") window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [key, navigationType]);

  return null;
};

export default ScrollToTop;
