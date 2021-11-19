import React, { useRef, useEffect } from "react";

import "./Map.css";

const Map = (props) => {
  const google = window.google;
  const mapRef = useRef();
  const { center, zoom } = props;

  useEffect(() => {
    const map = new google.maps.Map(mapRef.current, {
      center: center,
      zoom: zoom,
    });

    new google.maps.Marker({ position: center, map: map });
  }, [center, zoom]);

  return (
    <div
      ref={mapRef}
      className={`map ${props.className}`}
      style={props.style}
    ></div>
  );
};

export default Map;
