import json
from pathlib import Path

import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parents[1]
GTFS_DIR = BACKEND_DIR / "data" / "gtfs"
OUTPUT_DIR = BACKEND_DIR / "data" / "processed"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

routes = pd.read_csv(GTFS_DIR / "routes.txt")
trips = pd.read_csv(GTFS_DIR / "trips.txt")
stop_times = pd.read_csv(GTFS_DIR / "stop_times.txt")
stops = pd.read_csv(GTFS_DIR / "stops.txt")

subway_routes = routes[routes["route_type"] == 1]

subway_trips = trips[trips["route_id"].isin(subway_routes["route_id"])]

subway_stop_times = stop_times[
    stop_times["trip_id"].isin(subway_trips["trip_id"])
]

subway_stops = stops[
    stops["stop_id"].isin(subway_stop_times["stop_id"])
].copy()


def clean_station_name(name: str) -> str:
    name = name.replace(" Station", "")
    name = name.replace(" - Northbound Platform", "")
    name = name.replace(" - Southbound Platform", "")
    name = name.replace(" - Eastbound Platform", "")
    name = name.replace(" - Westbound Platform", "")
    name = name.replace(" - Subway Platform", "")

    name = name.replace("Union Towards Finch", "Union")
    name = name.replace("Union Towards Vaughan Metropolitan Centre", "Union")

    station_aliases = {
        "Bloor": "Bloor-Yonge",
        "Yonge": "Bloor-Yonge",
    }

    cleaned_name = name.strip()

    return station_aliases.get(cleaned_name, cleaned_name)


subway_stops["name"] = subway_stops["stop_name"].apply(clean_station_name)

cleaned = (
    subway_stops[["name", "stop_lat", "stop_lon"]]
    .drop_duplicates(subset=["name"])
    .sort_values("name")
)

stations = []

for _, row in cleaned.iterrows():
    stations.append(
        {
            "name": row["name"],
            "lat": float(row["stop_lat"]),
            "lon": float(row["stop_lon"]),
        }
    )

output_path = OUTPUT_DIR / "subway_stations.json"

with open(output_path, "w", encoding="utf-8") as file:
    json.dump(stations, file, indent=2)

print(f"Saved {len(stations)} subway stations to {output_path}")