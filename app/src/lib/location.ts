"use client";

import { useCallback, useEffect, useState } from "react";

export interface Coords {
  lat: number;
  lng: number;
}

/**
 * The player's location, asked only after an in-app explanation (session 7).
 * "prompt" means we may ask; "declined" is our own "Ahora no"; "denied" comes from the browser.
 */
export type LocationState =
  | { status: "prompt" }
  | { status: "declined" }
  | { status: "locating" }
  | { status: "ready"; coords: Coords }
  | { status: "denied" }
  | { status: "unavailable" };

export function useLocation() {
  const [state, setState] = useState<LocationState>({ status: "prompt" });

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "unavailable" });
      return;
    }
    setState({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (position) => setState({ status: "ready", coords: { lat: position.coords.latitude, lng: position.coords.longitude } }),
      (error) => setState({ status: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  // Skip the explanation when the browser already granted (or blocked) access.
  useEffect(() => {
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((permission) => {
        if (permission.state === "granted") locate();
        else if (permission.state === "denied") setState({ status: "denied" });
      })
      .catch(() => {});
  }, [locate]);

  const decline = useCallback(() => setState({ status: "declined" }), []);

  return { state, locate, decline };
}
