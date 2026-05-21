"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const RouteMap = dynamic(() => import("../components/RouteMap"), {
  ssr: false,
});

type Station = {
  name: string;
  lat: number;
  lon: number;
};

type Transfer = {
  station: string;
  fromLine: string;
  toLine: string;
};

type LiveAlert = {
  header?: string;
  description?: string;
  severity?: string;
  routes?: string[];
};

type RouteOption = {
  label: string;
  recommendedRoute: string;
  estimatedStops: number | null;
  estimatedMinutes: number | null;
  delayRisk: string;
  reason: string;
  path: string[];
  segmentLines: string[];
  transfers: Transfer[];
  liveAlertCount: number;
  liveAlerts: LiveAlert[];
};

type TripResult = RouteOption & {
  routes?: RouteOption[];
};

function getCurrentTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getLineColor(line: string | undefined, darkMode: boolean) {
  if (line === "Line 1") return "bg-yellow-400";
  if (line === "Line 2") return "bg-green-500";
  if (line === "Line 4") return "bg-pink-500";
  return darkMode ? "bg-zinc-700" : "bg-gray-300";
}

export default function HomePage() {
  const [darkMode, setDarkMode] = useState(true);

  const [stations, setStations] = useState<Station[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [showStartSuggestions, setShowStartSuggestions] = useState(false);
  const [showEndSuggestions, setShowEndSuggestions] = useState(false);
  const [showRouteDetails, setShowRouteDetails] = useState(false);

  const [result, setResult] = useState<TripResult | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currentRoute = selectedRoute ?? result;

  useEffect(() => {
    async function fetchStations() {
      const response = await fetch("http://127.0.0.1:8000/stations");
      const data = await response.json();
      setStations(data.stations);
    }

    fetchStations();
  }, []);

  const transferStations = useMemo(() => {
    return new Set(
      currentRoute?.transfers.map((transfer) => transfer.station) ?? []
    );
  }, [currentRoute]);

  const filteredStartStations = useMemo(() => {
    const query = start.toLowerCase().trim();

    if (!query) return [];

    return stations
      .filter((station) => station.name.toLowerCase().startsWith(query))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [stations, start]);

  const filteredEndStations = useMemo(() => {
    const query = end.toLowerCase().trim();

    if (!query) return [];

    return stations
      .filter((station) => station.name.toLowerCase().startsWith(query))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [stations, end]);

  async function handlePlanTrip() {
    setLoading(true);
    setError("");
    setResult(null);
    setSelectedRoute(null);
    setShowRouteDetails(false);

    const validStationNames = stations.map((station) => station.name);

    if (!validStationNames.includes(start)) {
      setError("Please select a valid starting station.");
      setLoading(false);
      return;
    }

    if (!validStationNames.includes(end)) {
      setError("Please select a valid destination station.");
      setLoading(false);
      return;
    }

    if (start === end) {
      setError("Starting station and destination cannot be the same.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:8000/trip/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start,
          end,
          time: getCurrentTime(),
        }),
      });

      const data: TripResult = await response.json();
      setResult(data);
      setSelectedRoute(data.routes?.[0] ?? data);
    } catch (error) {
      console.error("Trip planning failed:", error);
      setError("Unable to connect to backend.");
    } finally {
      setLoading(false);
    }
  }

  const cardClass = darkMode
    ? "border-white/10 bg-zinc-950 text-white shadow-black/30"
    : "border-gray-200 bg-white text-black shadow-sm";

  const inputClass = darkMode
    ? "w-full rounded-xl border border-white/10 bg-zinc-900 p-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-yellow-400"
    : "w-full rounded-xl border border-gray-200 bg-white p-3 text-black outline-none transition placeholder:text-gray-400 focus:border-black";

  const mutedText = darkMode ? "text-zinc-400" : "text-gray-500";

  return (
    <main
      className={`min-h-screen p-8 transition-colors duration-300 ${
        darkMode ? "bg-black text-white" : "bg-gray-50 text-black"
      }`}
    >
      <button
        type="button"
        onClick={() => setDarkMode((current) => !current)}
        className={`fixed right-5 top-5 z-50 flex h-11 w-11 items-center justify-center rounded-full border text-lg shadow-lg transition hover:scale-105 ${
          darkMode
            ? "border-white/10 bg-zinc-900 text-white"
            : "border-gray-200 bg-white text-black"
        }`}
      >
        {darkMode ? "☀️" : "🌙"}
      </button>

      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            TTC Subway Planner
          </h1>

          <p className={`mt-2 ${mutedText}`}>
            Compare TTC subway routes using GTFS schedules and live service
            alerts.
          </p>
        </div>

        <div className={`space-y-4 rounded-3xl border p-5 ${cardClass}`}>
          <div className="relative">
            <input
              type="text"
              placeholder="Starting station"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setShowStartSuggestions(true);
              }}
              className={inputClass}
            />

            {showStartSuggestions &&
              start &&
              filteredStartStations.length > 0 && (
                <div
                  className={`absolute z-20 mt-2 w-full overflow-hidden rounded-xl border shadow-lg ${
                    darkMode
                      ? "border-white/10 bg-zinc-900"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  {filteredStartStations.map((station) => (
                    <button
                      key={`${station.name}-${station.lat}-${station.lon}`}
                      type="button"
                      onClick={() => {
                        setStart(station.name);
                        setShowStartSuggestions(false);
                      }}
                      className={`block w-full px-4 py-3 text-left transition ${
                        darkMode
                          ? "text-white hover:bg-zinc-800"
                          : "text-black hover:bg-gray-100"
                      }`}
                    >
                      {station.name}
                    </button>
                  ))}
                </div>
              )}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Destination station"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setShowEndSuggestions(true);
              }}
              className={inputClass}
            />

            {showEndSuggestions &&
              end &&
              filteredEndStations.length > 0 && (
                <div
                  className={`absolute z-20 mt-2 w-full overflow-hidden rounded-xl border shadow-lg ${
                    darkMode
                      ? "border-white/10 bg-zinc-900"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  {filteredEndStations.map((station) => (
                    <button
                      key={`${station.name}-${station.lat}-${station.lon}`}
                      type="button"
                      onClick={() => {
                        setEnd(station.name);
                        setShowEndSuggestions(false);
                      }}
                      className={`block w-full px-4 py-3 text-left transition ${
                        darkMode
                          ? "text-white hover:bg-zinc-800"
                          : "text-black hover:bg-gray-100"
                      }`}
                    >
                      {station.name}
                    </button>
                  ))}
                </div>
              )}
          </div>

          <button
            onClick={handlePlanTrip}
            disabled={loading || !start || !end}
            className="w-full rounded-xl bg-yellow-400 p-3 font-semibold text-black transition hover:scale-[1.01] hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Planning..." : "Plan Trip"}
          </button>

          {error && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                darkMode
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {error}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Map</h2>

            <p className={`text-sm ${mutedText}`}>
              {currentRoute
                ? "Showing selected route"
                : "Plan a trip to view your route"}
            </p>
          </div>

          <RouteMap
            stations={stations}
            path={currentRoute?.path ?? []}
            segmentLines={currentRoute?.segmentLines ?? []}
            darkMode={darkMode}
          />
        </div>

        {result && currentRoute && (
          <div className={`space-y-4 rounded-3xl border p-6 ${cardClass}`}>
            <div>
              <h2 className="text-2xl font-semibold">Route Options</h2>

              <p className={mutedText}>
                Compare fastest route and lowest live delay risk.
              </p>
            </div>

            <div className="grid gap-3">
              {(result.routes ?? [result]).map((route) => {
                const isSelected =
                  currentRoute.path.join("|") === route.path.join("|");

                return (
                  <button
                    key={`${route.label}-${route.path.join("-")}`}
                    type="button"
                    onClick={() => {
                      setSelectedRoute(route);
                      setShowRouteDetails(false);
                    }}
                    className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                      isSelected
                        ? "scale-[1.01] border-yellow-400 bg-yellow-400 text-black shadow-lg"
                        : darkMode
                        ? "border-white/10 bg-zinc-900 text-white hover:-translate-y-0.5 hover:bg-zinc-800"
                        : "border-gray-200 bg-white text-black hover:-translate-y-0.5 hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold">{route.label}</p>

                        <p
                          className={
                            isSelected
                              ? "text-black/70"
                              : darkMode
                              ? "text-zinc-400"
                              : "text-gray-500"
                          }
                        >
                          {route.recommendedRoute}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {route.estimatedMinutes !== null
                            ? `${route.estimatedMinutes} min`
                            : "N/A"}
                        </p>

                        <p
                          className={
                            isSelected
                              ? "text-black/70"
                              : darkMode
                              ? "text-zinc-400"
                              : "text-gray-500"
                          }
                        >
                          {route.delayRisk} risk
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <p>
                <strong>Selected Route:</strong>{" "}
                {currentRoute.recommendedRoute}
              </p>

              <p>
                <strong>Estimated Stops:</strong>{" "}
                {currentRoute.estimatedStops ?? "N/A"}
              </p>

              <p>
                <strong>Estimated Time:</strong>{" "}
                {currentRoute.estimatedMinutes !== null
                  ? `${currentRoute.estimatedMinutes} min`
                  : "N/A"}
              </p>

              <p>
                <strong>Delay Risk:</strong> {currentRoute.delayRisk}
              </p>

              <p className={mutedText}>{currentRoute.reason}</p>

              {(currentRoute.delayRisk === "High" ||
                currentRoute.delayRisk === "Medium") &&
                currentRoute.liveAlerts.length > 0 && (
                  <div
                    className={`space-y-3 rounded-2xl border p-4 ${
                      darkMode
                        ? "border-orange-400/20 bg-orange-400/10"
                        : "border-orange-200 bg-orange-50"
                    }`}
                  >
                    <h3 className="font-semibold text-orange-400">
                      Live TTC Alerts
                    </h3>

                    {currentRoute.liveAlerts
                      .slice(0, 3)
                      .map((alert, index) => (
                        <div
                          key={index}
                          className={`rounded-2xl p-4 text-sm ${
                            darkMode ? "bg-black/30" : "bg-white"
                          }`}
                        >
                          <p className="wrap-break-words text-sm font-semibold leading-relaxed">
                            {alert.header || "Service disruption reported."}
                          </p>

                          {alert.description && (
                            <p
                              className={`mt-2 wrap-break-words text-sm leading-relaxed ${mutedText}`}
                            >
                              {alert.description}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                )}
            </div>

            {currentRoute.transfers.length > 0 && (
              <div
                className={`rounded-2xl border p-4 ${
                  darkMode
                    ? "border-yellow-400/30 bg-yellow-400/10 text-white"
                    : "border-yellow-200 bg-yellow-50 text-black"
                }`}
              >
                <h3 className="font-semibold">Transfer</h3>

                {currentRoute.transfers.map((transfer) => (
                  <p
                    key={`${transfer.station}-${transfer.fromLine}-${transfer.toLine}`}
                  >
                    Transfer at <strong>{transfer.station}</strong>:{" "}
                    {transfer.fromLine} → {transfer.toLine}
                  </p>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowRouteDetails((current) => !current)}
              className={`rounded-xl border px-4 py-2 transition ${
                darkMode
                  ? "border-white/10 hover:bg-zinc-800"
                  : "border-gray-200 hover:bg-gray-100"
              }`}
            >
              {showRouteDetails ? "Hide station path" : "View station path"}
            </button>

            {showRouteDetails && (
              <div
                className={`rounded-2xl border p-4 ${
                  darkMode ? "border-white/10" : "border-gray-200"
                }`}
              >
                <h3 className="mb-4 font-semibold">Station Path</h3>

                <div className="space-y-0">
                  {currentRoute.path.map((station, index) => {
                    const isTransfer = transferStations.has(station);

                    const currentLine =
                      currentRoute.segmentLines[
                        Math.min(index, currentRoute.segmentLines.length - 1)
                      ];

                    const nextLine =
                      currentRoute.segmentLines[
                        Math.min(
                          index + 1,
                          currentRoute.segmentLines.length - 1
                        )
                      ];

                    const lineColor = getLineColor(currentLine, darkMode);
                    const connectorColor = getLineColor(nextLine, darkMode);

                    return (
                      <div key={`${station}-${index}`} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={`h-4 w-4 rounded-full border-2 border-white ${lineColor} ${
                              isTransfer
                                ? "scale-125 ring-4 ring-yellow-400/30"
                                : ""
                            }`}
                          />

                          {index < currentRoute.path.length - 1 && (
                            <div className={`h-10 w-1 ${connectorColor}`} />
                          )}
                        </div>

                        <div className="pb-6">
                          <p className="text-lg font-medium">{station}</p>

                          {isTransfer && (
                            <div className="mt-1 inline-flex rounded-full bg-yellow-400 px-3 py-1 text-xs font-semibold text-black">
                              Transfer here
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}