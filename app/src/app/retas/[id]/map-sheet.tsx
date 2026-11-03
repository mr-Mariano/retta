"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useLocation, type Coords } from "@/lib/location";
import { MAPBOX_TOKEN, fetchRoute, formatDistance, formatDuration, type Route, type RouteLine } from "@/lib/mapbox";

interface Field {
  name: string;
  address: string;
  coords: Coords | null;
}

/** Round map button in the match detail; opens the in-app map sheet (session 7). */
export function MapButton({ field }: { field: Field }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ver ${field.name} en el mapa`}
        aria-haspopup="dialog"
        className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-elevated text-ink"
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
          <path d="M9 4v14" />
          <path d="M15 6v14" />
        </svg>
      </button>
      {open && <MapSheet field={field} onClose={() => setOpen(false)} />}
    </>
  );
}

function MapSheet({ field, onClose }: { field: Field; onClose: () => void }) {
  const location = useLocation();
  const [routes, setRoutes] = useState<{ driving: Route | null; walking: Route | null } | null>(null);
  const userCoords = location.state.status === "ready" ? location.state.coords : null;
  const navigateUrl = field.coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${field.coords.lat},${field.coords.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${field.name}, ${field.address}`)}`;

  // Close on Escape and keep the page behind from scrolling.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = overflow;
    };
  }, [onClose]);

  useEffect(() => {
    if (!userCoords || !field.coords || !MAPBOX_TOKEN) return;
    const to = field.coords;
    Promise.all([fetchRoute("driving", userCoords, to), fetchRoute("walking", userCoords, to)])
      .then(([driving, walking]) => setRoutes({ driving, walking }))
      .catch(() => setRoutes({ driving: null, walking: null }));
  }, [userCoords, field.coords]);

  return (
    <div className="fixed inset-0 z-30 mx-auto max-w-md">
      <button type="button" aria-label="Cerrar mapa" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mapa-titulo"
        className="absolute inset-x-0 bottom-0 flex flex-col gap-4 rounded-t-3xl border-t border-line bg-surface px-5 pt-3 pb-8"
      >
        <span aria-hidden="true" className="h-[5px] w-10 self-center rounded-full bg-line" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id="mapa-titulo" className="font-display text-[28px] leading-none font-medium">
              {field.name}
            </h2>
            <span className="text-sm text-muted">{field.address}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-elevated text-ink"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {field.coords && MAPBOX_TOKEN ? (
          <FieldMap field={field.coords} user={userCoords} route={routes?.driving?.line ?? null} />
        ) : (
          <div className="flex h-[200px] items-center justify-center rounded-[14px] border border-line bg-base px-6 text-center text-sm text-muted">
            El mapa no está disponible para esta cancha.
          </div>
        )}

        <TravelInfo location={location} routes={routes} canRoute={Boolean(field.coords && MAPBOX_TOKEN)} />

        <a
          href={navigateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-full border border-line text-[16px] font-semibold text-ink"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
          </svg>
          Abrir en otra app para navegar
        </a>
      </section>
    </div>
  );
}

function TravelInfo({
  location,
  routes,
  canRoute,
}: {
  location: ReturnType<typeof useLocation>;
  routes: { driving: Route | null; walking: Route | null } | null;
  canRoute: boolean;
}) {
  if (!canRoute) return null;
  const { state, locate, decline } = location;

  if (state.status === "prompt") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 rounded-xl bg-elevated p-3.5">
          <LocateIcon />
          <div className="flex flex-col gap-1">
            <span className="text-[16px] font-semibold">¿Cuánto tardas en llegar?</span>
            <span className="text-sm leading-snug text-muted">
              Usa tu ubicación para ver la ruta, la distancia y el tiempo estimado. Solo la usamos en tu teléfono; no la guardamos.
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={locate}
          className="flex h-[52px] items-center justify-center rounded-full bg-action text-[17px] font-semibold text-on-action"
        >
          Usar mi ubicación
        </button>
        <button type="button" onClick={decline} className="flex h-11 items-center justify-center text-[15px] font-semibold text-muted">
          Ahora no
        </button>
      </div>
    );
  }

  if (state.status === "declined") {
    return (
      <button type="button" onClick={locate} className="self-start text-[15px] font-semibold text-action">
        Ver cuánto tardo en llegar
      </button>
    );
  }

  if (state.status === "denied" || state.status === "unavailable") {
    return (
      <p className="text-sm text-muted">
        {state.status === "denied"
          ? "Sin permiso de ubicación. Actívalo en tu navegador para ver el tiempo estimado."
          : "No pudimos obtener tu ubicación. Inténtalo de nuevo en un momento."}
      </p>
    );
  }

  const loading = state.status === "locating" || !routes;
  return (
    <div className="flex gap-2.5" aria-live="polite">
      <TimeCard
        icon={<CarIcon />}
        value={loading ? "…" : routes.driving ? formatDuration(routes.driving.seconds) : "—"}
        label={routes?.driving ? `en auto · ${formatDistance(routes.driving.meters)}` : "en auto"}
        accent
      />
      <TimeCard
        icon={<WalkIcon />}
        value={loading ? "…" : routes.walking ? formatDuration(routes.walking.seconds) : "—"}
        label="caminando"
      />
    </div>
  );
}

function TimeCard({ icon, value, label, accent }: { icon: React.ReactNode; value: string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-1 items-center gap-2.5 rounded-xl bg-elevated p-3">
      <span className={accent ? "text-action" : "text-muted"}>{icon}</span>
      <div className="flex flex-col">
        <span className="text-[18px] leading-tight font-semibold">{value}</span>
        <span className="text-[13px] text-muted">{label}</span>
      </div>
    </div>
  );
}

/** Mapbox map with the field pin, the player's dot and the driving route. */
function FieldMap({ field, user, route }: { field: Coords; user: Coords | null; route: RouteLine | null }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const userMarker = useRef<{ remove: () => void } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelled || !container.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const instance = new mapboxgl.Map({
        container: container.current,
        style: dark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11",
        center: [field.lng, field.lat],
        zoom: 14,
        attributionControl: true,
      });
      new mapboxgl.Marker({ color: accentColor() }).setLngLat([field.lng, field.lat]).addTo(instance);
      instance.on("load", () => setLoaded(true));
      map.current = instance;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [field.lat, field.lng]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !loaded || !user) return;
    import("mapbox-gl").then(({ default: mapboxgl }) => {
      userMarker.current?.remove();
      const dot = document.createElement("span");
      dot.className = "block size-4 rounded-full border-2 border-white bg-action shadow-[0_0_0_6px_rgb(61_107_255/0.25)]";
      dot.setAttribute("aria-label", "Tu ubicación");
      userMarker.current = new mapboxgl.Marker({ element: dot }).setLngLat([user.lng, user.lat]).addTo(instance);

      const bounds = new mapboxgl.LngLatBounds([field.lng, field.lat], [field.lng, field.lat]).extend([user.lng, user.lat]);
      route?.coordinates.forEach((point) => bounds.extend(point));
      instance.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 600 });

      if (route) {
        const data = { type: "Feature" as const, properties: {}, geometry: route };
        const source = instance.getSource<GeoJSONSource>("route");
        if (source) source.setData(data);
        else {
          instance.addSource("route", { type: "geojson", data });
          instance.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": accentColor(), "line-width": 4 },
          });
        }
      }
    });
  }, [loaded, user, route, field.lat, field.lng]);

  return <div ref={container} role="img" aria-label="Mapa con la ubicación de la cancha" className="h-[250px] overflow-hidden rounded-[14px] border border-line" />;
}

/** The accent token, so the map follows light and dark mode. */
function accentColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--color-action-bg").trim() || "#3d6bff";
}

function LocateIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-action">
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17h14v-5l-2-5H7l-2 5z" />
      <circle cx="8" cy="17" r="2" />
      <circle cx="16" cy="17" r="2" />
    </svg>
  );
}

function WalkIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13" cy="4" r="2" />
      <path d="M10 21l2-6 3 3v3M9 12l3-4 3 3 3 1M12 8l-2 5" />
    </svg>
  );
}
