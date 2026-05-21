import heapq
import json
from pathlib import Path

from app.services.live_ttc_alerts import score_live_delay_risk

PROJECT_DIR = Path(__file__).resolve().parents[3]
GRAPH_PATH = PROJECT_DIR / "data" / "processed" / "subway_graph.json"


def load_graph():
    with open(GRAPH_PATH, "r", encoding="utf-8") as file:
        return json.load(file)


def simplify_lines(lines):
    simplified = []

    for line in lines:
        if not simplified or simplified[-1] != line:
            simplified.append(line)

    return simplified


def find_transfers(path, lines):
    transfers = []

    for index in range(1, len(lines)):
        previous_line = lines[index - 1]
        current_line = lines[index]

        if previous_line != current_line:
            transfers.append(
                {
                    "station": path[index],
                    "fromLine": previous_line,
                    "toLine": current_line,
                }
            )

    return transfers


def build_route_result(label, start, end, path, lines, stops, total_minutes):
    route_lines = simplify_lines(lines)
    transfer_details = find_transfers(path, lines)
    estimated_minutes = round(total_minutes, 1)
    live_risk = score_live_delay_risk(route_lines, path)

    return {
        "label": label,
        "recommendedRoute": " → ".join(route_lines),
        "estimatedStops": stops,
        "estimatedMinutes": estimated_minutes,
        "delayRisk": live_risk["delayRisk"],
        "confidence": 0.84,
        "reason": (
            f"{label} route from {start} to {end}: "
            f"{len(transfer_details)} transfer(s), {stops} stop(s), "
            f"and about {estimated_minutes} scheduled minute(s). "
            f"{live_risk['liveReason']}"
        ),
        "path": path,
        "segmentLines": lines,
        "transfers": transfer_details,
        "liveAlertCount": live_risk["liveAlertCount"],
        "liveAlerts": live_risk["liveAlerts"],
    }

def find_candidate_routes(start, end, max_routes=8):
    graph = load_graph()

    if start not in graph:
        return {"error": f"Unknown start station: {start}"}

    if end not in graph:
        return {"error": f"Unknown destination station: {end}"}

    if start == end:
        return [
            {
                "label": "Already There",
                "recommendedRoute": "Already at destination",
                "estimatedStops": 0,
                "estimatedMinutes": 0,
                "delayRisk": "Low",
                "confidence": 1.0,
                "reason": "Your start and destination stations are the same.",
                "path": [start],
                "transfers": [],
                "liveAlertCount": 0,
                "liveAlerts": [],
            }
        ]

    queue = []

    for edge in graph[start]:
        first_travel_minutes = float(edge.get("travelMinutes", 2))

        heapq.heappush(
            queue,
            (
                first_travel_minutes,
                0,
                1,
                edge["to"],
                edge["line"],
                [start, edge["to"]],
                [edge["line"]],
            ),
        )

    candidates = []
    seen_signatures = set()
    max_stops = 80

    while queue and len(candidates) < max_routes:
        (
            total_minutes,
            transfers,
            stops,
            current_station,
            current_line,
            path,
            lines,
        ) = heapq.heappop(queue)

        if stops > max_stops:
            continue

        if current_station == end:
            route_lines = simplify_lines(lines)
            signature = (tuple(path), tuple(route_lines))

            if signature not in seen_signatures:
                seen_signatures.add(signature)
                candidates.append(
                    {
                        "path": path,
                        "lines": lines,
                        "stops": stops,
                        "total_minutes": total_minutes,
                        "transfers": transfers,
                    }
                )

            continue

        for edge in graph[current_station]:
            next_station = edge["to"]
            next_line = edge["line"]

            if next_station in path:
                continue

            edge_minutes = float(edge.get("travelMinutes", 2))
            new_transfers = transfers + (1 if next_line != current_line else 0)

            heapq.heappush(
                queue,
                (
                    total_minutes + edge_minutes,
                    new_transfers,
                    stops + 1,
                    next_station,
                    next_line,
                    path + [next_station],
                    lines + [next_line],
                ),
            )

    return candidates

def risk_rank(delay_risk):
    ranking = {
        "Low": 0,
        "Medium": 1,
        "High": 2,
        "Unknown": 3,
    }

    return ranking.get(delay_risk, 3)

def find_route(start, end):
    candidates = find_candidate_routes(start, end)

    if isinstance(candidates, dict) and "error" in candidates:
        return {**candidates, "routes": []}

    if not candidates:
        return {
            "recommendedRoute": "No route found",
            "estimatedStops": None,
            "estimatedMinutes": None,
            "delayRisk": "Unknown",
            "confidence": 0.0,
            "reason": f"No GTFS route found from {start} to {end}.",
            "path": [],
            "transfers": [],
            "liveAlertCount": 0,
            "liveAlerts": [],
            "routes": [],
        }

    fastest_candidate = min(candidates, key=lambda route: route["total_minutes"])

    fastest_route = build_route_result(
        label="Fastest",
        start=start,
        end=end,
        path=fastest_candidate["path"],
        lines=fastest_candidate["lines"],
        stops=fastest_candidate["stops"],
        total_minutes=fastest_candidate["total_minutes"],
    )

    scored_routes = []

    for candidate in candidates:
        scored_routes.append(
            build_route_result(
                label="Lowest Live Delay Risk",
                start=start,
                end=end,
                path=candidate["path"],
                lines=candidate["lines"],
                stops=candidate["stops"],
                total_minutes=candidate["total_minutes"],
            )
        )

    lowest_risk_route = min(
        scored_routes,
        key=lambda route: (
            risk_rank(route["delayRisk"]),
            route["estimatedMinutes"] if route["estimatedMinutes"] is not None else 9999,
        ),
    )

    route_options = [fastest_route]

    if lowest_risk_route["path"] != fastest_route["path"]:
        route_options.append(lowest_risk_route)

    selected_route = route_options[0]

    return {
        **selected_route,
        "routes": route_options,
    }