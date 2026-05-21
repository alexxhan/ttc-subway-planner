from pathlib import Path
import json
import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parents[1]
GTFS_DIR = BACKEND_DIR / "data" / "gtfs"
OUTPUT_DIR = BACKEND_DIR / "data" / "processed"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

routes = pd.read_csv(GTFS_DIR / "routes.txt")
trips = pd.read_csv(GTFS_DIR / "trips.txt")
stop_times = pd.read_csv(GTFS_DIR / "stop_times.txt")
stops = pd.read_csv(GTFS_DIR / "stops.txt")


def time_to_seconds(time_value: str) -> int:
    hours, minutes, seconds = map(int, time_value.split(":"))
    return hours * 3600 + minutes * 60 + seconds


def clean_station_name(name: str) -> str:
    name = name.replace(" Station", "")
    name = name.replace(" - Northbound Platform", "")
    name = name.replace(" - Southbound Platform", "")
    name = name.replace(" - Eastbound Platform", "")
    name = name.replace(" - Westbound Platform", "")
    name = name.replace(" - Subway Platform", "")
    name = name.replace("Union Towards Finch", "Union")
    name = name.replace("Union Towards Vaughan Metropolitan Centre", "Union")

    aliases = {
        "Bloor": "Bloor-Yonge",
        "Yonge": "Bloor-Yonge",
    }

    name = name.strip()
    return aliases.get(name, name)


subway_routes = routes[routes["route_type"] == 1]
subway_trips = trips[trips["route_id"].isin(subway_routes["route_id"])]

merged = (
    stop_times[stop_times["trip_id"].isin(subway_trips["trip_id"])]
    .merge(subway_trips[["trip_id", "route_id"]], on="trip_id")
    .merge(routes[["route_id", "route_short_name"]], on="route_id")
    .merge(stops[["stop_id", "stop_name"]], on="stop_id")
)

merged["station_name"] = merged["stop_name"].apply(clean_station_name)
merged["arrival_seconds"] = merged["arrival_time"].apply(time_to_seconds)
merged["departure_seconds"] = merged["departure_time"].apply(time_to_seconds)

edge_times = {}

for trip_id, trip_stops in merged.groupby("trip_id"):
    trip_stops = trip_stops.sort_values("stop_sequence").reset_index(drop=True)

    for index in range(len(trip_stops) - 1):
        current = trip_stops.iloc[index]
        next_stop = trip_stops.iloc[index + 1]

        from_station = current["station_name"]
        to_station = next_stop["station_name"]

        if from_station == to_station:
            continue

        line = f"Line {current['route_short_name']}"

        travel_seconds = next_stop["arrival_seconds"] - current["departure_seconds"]

        if travel_seconds <= 0:
            continue

        travel_minutes = max(1, round(travel_seconds / 60))

        edge_key = (from_station, to_station, line)
        reverse_edge_key = (to_station, from_station, line)

        edge_times.setdefault(edge_key, []).append(travel_minutes)
        edge_times.setdefault(reverse_edge_key, []).append(travel_minutes)

graph = {}

for (from_station, to_station, line), times in edge_times.items():
    graph.setdefault(from_station, [])

    average_minutes = round(sum(times) / len(times), 1)

    graph[from_station].append(
        {
            "to": to_station,
            "line": line,
            "travelMinutes": average_minutes,
        }
    )

output_path = OUTPUT_DIR / "subway_graph.json"

with open(output_path, "w", encoding="utf-8") as file:
    json.dump(graph, file, indent=2)

print(f"Saved subway graph with {len(graph)} stations to {output_path}")