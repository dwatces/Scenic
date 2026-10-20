import { useState } from "react";

import "./Avatar.css";

// Dark enough for white text (at least 4.5:1).
const MONOGRAM_COLOURS = ["#2f5d8a", "#7a4a8c", "#2e6b4f", "#8a4b2f", "#4b5563", "#8a3b5c"];

/** The first letter of a name, for the monogram. */
export function initialOf(name) {
  const first = [...String(name || "").trim()][0];
  return first ? first.toLocaleUpperCase("en-NZ") : "?";
}

function colourFor(name) {
  let hash = 0;
  for (const char of String(name || "")) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return MONOGRAM_COLOURS[hash % MONOGRAM_COLOURS.length];
}

/**
 * A member's avatar: their image, or their initial when they have none or
 * it fails to load. Decorative by default (the name is always shown next
 * to it); pass `alt` when it stands alone.
 * @param {{ src: string | null, name: string, size?: number, alt?: string, className?: string }} props
 */
const Avatar = ({ src, name, size = 56, alt = "", className = "" }) => {
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <span className={`avatar ${className}`.trim()} style={{ width: size, height: size }}>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span
          className="avatar__monogram"
          style={{ background: colourFor(name), fontSize: Math.round(size * 0.42) }}
          {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
        >
          {initialOf(name)}
        </span>
      )}
    </span>
  );
};

export default Avatar;
