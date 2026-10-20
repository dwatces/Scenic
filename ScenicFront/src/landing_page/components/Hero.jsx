import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import {
  useDocumentHidden,
  useOnScreen,
  usePageLoaded,
  usePrefersReducedMotion,
} from "../../shared/hooks/media-hooks";
import { HERO_FRAMES, TALL_MEDIA } from "./hero-frames";
import "./Hero.css";

export const HERO_INTERVAL_MS = 4500;
export const HEADLINE = "What should I do with my photos?";

/** The next frame after `active` that has loaded, or `active` if none has. */
export function nextLoadedFrame(active, loaded, count) {
  for (let step = 1; step < count; step++) {
    const candidate = (active + step) % count;
    if (loaded.has(candidate)) return candidate;
  }
  return active;
}

const HeroFrame = ({ frame, first, active, onLoaded }) => {
  // A cached image can finish before React attaches onLoad.
  const imageRef = useCallback(
    (img) => {
      if (img && img.complete && img.naturalWidth > 0) onLoaded();
    },
    [onLoaded],
  );
  return (
    <picture className={`hero__frame${active ? " is-active" : ""}`}>
      <source type="image/avif" media={TALL_MEDIA} srcSet={frame.tallAvif} sizes="100vw" />
      <source
        type="image/webp"
        media={TALL_MEDIA}
        srcSet={`${frame.tallWebp.url} ${frame.tallWebp.width}w`}
        sizes="100vw"
      />
      <source type="image/avif" srcSet={frame.wideAvif} sizes="100vw" />
      <img
        ref={imageRef}
        src={frame.wideWebp.url}
        alt=""
        width="1440"
        height="900"
        fetchPriority={first ? "high" : "low"}
        onLoad={onLoaded}
      />
    </picture>
  );
};

/**
 * The signed-out landing hero: a full-bleed photo behind "What should I do
 * with my <street scenes>?", whose last words change with the photo.
 *
 * - The first photo is in the first render (it is the largest paint). The
 *   others load after the window's load event, and never with reduced motion.
 * - The rotation only moves to a photo that has loaded, and pauses with the
 *   Pause button, off screen and in a hidden tab.
 * - Screen readers get the headline as one plain question, so the changing
 *   words are never re-announced.
 * - All the words share one grid cell, so swapping them never moves the page.
 */
const Hero = () => {
  const section = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const pageLoaded = usePageLoaded();
  const hidden = useDocumentHidden();
  const onScreen = useOnScreen(section);

  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState(() => new Set());
  const [paused, setPaused] = useState(false);

  const markLoaded = useCallback(
    (index) => setLoaded((current) => (current.has(index) ? current : new Set(current).add(index))),
    [],
  );
  const loadHandlers = useMemo(
    () => HERO_FRAMES.map((_, index) => () => markLoaded(index)),
    [markLoaded],
  );

  const canRotate = !reducedMotion;
  const showAllFrames = canRotate && pageLoaded && loaded.has(0);
  const running = canRotate && !paused && !hidden && onScreen && loaded.size > 1;
  // With reduced motion, the first photo and its words stay put.
  const shown = canRotate ? active : 0;

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(
      () => setActive((current) => nextLoadedFrame(current, loaded, HERO_FRAMES.length)),
      HERO_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [running, loaded]);

  return (
    <section className="hero" aria-labelledby="hero-heading" ref={section}>
      <div className="hero__frames" aria-hidden="true">
        {HERO_FRAMES.map((frame, index) =>
          index === 0 || showAllFrames ? (
            <HeroFrame
              key={frame.photo}
              frame={frame}
              first={index === 0}
              active={index === shown}
              onLoaded={loadHandlers[index]}
            />
          ) : null,
        )}
      </div>
      <div className="hero__scrim" aria-hidden="true" />

      <div className="hero__content">
        <h1 id="hero-heading" className="hero__title">
          <span className="visually-hidden">{HEADLINE}</span>
          <span aria-hidden="true">
            <span className="hero__lead-in">What should I do with my</span>{" "}
            <span className="hero__words">
              {HERO_FRAMES.map((frame, index) => (
                <span
                  key={frame.word}
                  className={`hero__word${index === shown ? " is-active" : ""}`}
                >
                  <span className="hero__word-text">{frame.word}</span>?
                </span>
              ))}
            </span>
          </span>
        </h1>
        <p className="hero__lede">
          Share them on Scenic. Post a photo, say where you took it, and see it on the map.
        </p>
        <div className="hero__actions">
          <Link className="hero__cta hero__cta--primary" to="/explore">
            Browse scenes
          </Link>
          <Link className="hero__cta hero__cta--secondary" to="/signup">
            Sign up
          </Link>
        </div>
        {canRotate && (
          <button
            type="button"
            className="hero__pause"
            aria-pressed={paused}
            aria-label="Pause slideshow"
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? (
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                <rect x="6.5" y="5.5" width="4" height="13" rx="1" fill="currentColor" />
                <rect x="13.5" y="5.5" width="4" height="13" rx="1" fill="currentColor" />
              </svg>
            )}
          </button>
        )}
      </div>
    </section>
  );
};

export default Hero;
