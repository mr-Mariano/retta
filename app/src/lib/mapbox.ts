import type { Coords } from "./location";

/** Public token, restricted to the app's URLs in the Mapbox account. */
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const API = "https://api.mapbox.com";

const point = (c: Coords) => `${c.lng},${c.lat}`;

/** GeoJSON line as Mapbox returns it with `geometries=geojson`. */
export interface RouteLine {
  type: "LineString";
  coordinates: [number, number][];
}

export interface Route {
  seconds: number;
  meters: number;
  line: RouteLine;
}

/** Fastest route between two points, or null when Mapbox finds none. */
export async function fetchRoute(profile: "driving" | "walking", from: Coords, to: Coords): Promise<Route | null> {
  const url = `${API}/directions/v5/mapbox/${profile}/${point(from)};${point(to)}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const route = (await response.json()).routes?.[0];
  return route ? { seconds: route.duration, meters: route.distance, line: route.geometry } : null;
}

/** Driving time and distance from one origin to many destinations (Matrix API, up to 24). */
export async function fetchTravelTimes(
  from: Coords,
  destinations: Coords[],
): Promise<({ seconds: number; meters: number } | null)[]> {
  if (destinations.length === 0) return [];
  const coords = [from, ...destinations].map(point).join(";");
  const url = `${API}/directions-matrix/v1/mapbox/driving/${coords}?sources=0&annotations=duration,distance&access_token=${MAPBOX_TOKEN}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Matrix ${response.status}`);
  const data = await response.json();
  return destinations.map((_, i) => {
    const seconds = data.durations?.[0]?.[i + 1];
    const meters = data.distances?.[0]?.[i + 1];
    return typeof seconds === "number" && typeof meters === "number" ? { seconds, meters } : null;
  });
}

/** "12 min" or "1 h 5 min" */
export function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** "3.4 km" or "800 m" */
export function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters / 50) * 50} m` : `${(meters / 1000).toFixed(1)} km`;
}
