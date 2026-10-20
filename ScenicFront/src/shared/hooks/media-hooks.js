import { useEffect, useState, useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const reducedMotionNow = () =>
  typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION).matches;

/** True while the visitor's system asks for less motion (it can change at any time). */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => false);
}

/** True once the window's load event has fired (straight away on later visits in the app). */
export function usePageLoaded() {
  const [loaded, setLoaded] = useState(() => document.readyState === "complete");
  useEffect(() => {
    if (loaded) return undefined;
    const done = () => setLoaded(true);
    window.addEventListener("load", done);
    return () => window.removeEventListener("load", done);
  }, [loaded]);
  return loaded;
}

function subscribeVisibility(onChange) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** True while the tab is hidden. */
export function useDocumentHidden() {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.hidden,
    () => false,
  );
}

/** True while the element is at least partly on screen. */
export function useOnScreen(ref) {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver !== "function") return undefined;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return onScreen;
}
