"use client";

import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";

type Station = {
  name: string;
  lat: number;
  lon: number;
};

type RouteMapProps = {
  stations: Station[];
  path?: string[];
  segmentLines?: string[];
  darkMode: boolean;
};

const LINE_COLORS: Record<string, string> = {
  "Line 1": "#f6c700",
  "Line 2": "#00a859",
  "Line 4": "#b6007c",
  "Line 5": "#f28c28",
  "Line 6": "#d71920",
};

export default function RouteMap({
  stations,
  path = [],
  segmentLines = [],
  darkMode,
}: RouteMapProps) {
  const pathStations = path
    .map((name) => stations.find((station) => station.name === name))
    .filter((station): station is Station => Boolean(station));

  const positions: [number, number][] = pathStations.map((station) => [
    station.lat,
    station.lon,
  ]);

  const hasRoute = positions.length > 0;
  const defaultCenter: [number, number] = [43.6532, -79.3832];
  const bounds = hasRoute ? L.latLngBounds(positions) : undefined;

  const tileUrl = darkMode
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <div
      className={`relative h-80 w-full overflow-hidden rounded-3xl border shadow-sm ${
        darkMode ? "border-white/10" : "border-gray-200"
      }`}
    >
      <MapContainer
        center={hasRoute ? undefined : defaultCenter}
        bounds={bounds}
        zoom={hasRoute ? undefined : 11}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer attribution="© OpenStreetMap" url={tileUrl} />

        {hasRoute &&
          positions.slice(0, -1).map((position, index) => {
            const nextPosition = positions[index + 1];
            const line = segmentLines[index] ?? segmentLines[0] ?? "Line 1";
            const color = LINE_COLORS[line] ?? "#ffffff";

            return (
              <Polyline
                key={`${index}-${line}`}
                positions={[position, nextPosition]}
                pathOptions={{
                  color,
                  weight: 7,
                  opacity: 0.95,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            );
          })}

        {pathStations.map((station, index) => {
          const isStart = index === 0;
          const isEnd = index === pathStations.length - 1;

          return (
            <CircleMarker
              key={`${station.name}-${index}`}
              center={[station.lat, station.lon]}
              radius={isStart || isEnd ? 9 : 5}
              pathOptions={{
                color: isStart ? "#22c55e" : isEnd ? "#ef4444" : "#ffffff",
                fillColor: isStart ? "#22c55e" : isEnd ? "#ef4444" : "#111827",
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Popup className="clean-map-popup" closeButton={false}>
                <div className="text-sm font-semibold text-black">
                  {isStart ? "Start: " : isEnd ? "End: " : ""}
                  {station.name}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}