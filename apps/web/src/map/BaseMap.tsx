import { useEffect, useRef } from "react";
import { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Coordinates } from "@aither/shared";

// Placeholder default view so the base map boots somewhere recognizable.
const DEFAULT_CENTER: Coordinates = { latitude: 33.4484, longitude: -112.07396 };
const DEFAULT_ZOOM = 11;

function buildStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "&copy; OpenStreetMap contributors"
      }
    },
    layers: [
      {
        id: "osm-base",
        type: "raster",
        source: "osm"
      }
    ]
  };
}

type BaseMapProps = {
  center?: Coordinates;
  zoom?: number;
};

export default function BaseMap({ center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM }: BaseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new MapLibreMap({
      container: containerRef.current,
      // MapLibre expects [longitude, latitude]; keep the shared Coordinates object explicit.
      center: [center.longitude, center.latitude],
      zoom,
      style: buildStyle()
    });

    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}