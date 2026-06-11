import React from "react";

import "./Map.css";

/* Keyless map: OpenStreetMap embed centered on the scene marker.
   (Replaced the Google Maps JS API, which required a billing key and
   crashed when window.google was absent.) */
const Map = (props) => {
  const { center, zoom } = props;
  const span = 0.02 / Math.max(1, (zoom || 16) / 8);
  const bbox = [
    center.lng - span,
    center.lat - span,
    center.lng + span,
    center.lat + span,
  ].join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox
  )}&layer=mapnik&marker=${center.lat},${center.lng}`;

  return (
    <iframe
      title="Scene location map"
      className={`map ${props.className || ""}`}
      style={{ border: 0, ...props.style }}
      src={src}
      loading="lazy"
    />
  );
};

export default Map;
