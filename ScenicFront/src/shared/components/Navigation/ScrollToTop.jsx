import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router";

/**
 * A new page opens at the top. The browser only does this on a full page
 * load; in the app the last page's scroll position would carry over, so
 * after "Save changes" at the bottom of a long form the next page opened
 * part-way down, its photo under the fixed header. Links, redirects and
 * forms that navigate (PUSH and REPLACE) scroll to the top; Back and
 * Forward (POP) are left alone, so the browser can put the visitor back
 * where they were.
 *
 * A layout effect, so it runs before the page paints and before
 * PageHeading moves focus to the new h1. "instant" because the html element
 * scrolls smoothly for in-page jumps.
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
