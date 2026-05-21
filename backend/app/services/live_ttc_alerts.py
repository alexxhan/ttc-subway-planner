import re
import requests
from google.transit import gtfs_realtime_pb2

ALERTS_URL = "https://bustime.ttc.ca/gtfsrt/alerts"

HIGH_SEVERITY_KEYWORDS = [
    "no service",
    "suspended",
    "not operating",
    "closed",
    "emergency",
    "collision",
    "security incident",
    "fire",
]

MEDIUM_SEVERITY_KEYWORDS = [
    "delay",
    "delays",
    "slower",
    "bypassing",
    "holding",
    "shuttle",
    "service adjustment",
]

ADVISORY_KEYWORDS = [
    "elevator",
    "escalator",
    "accessibility",
    "maintenance",
    "construction",
]


def get_live_alerts():
    feed = gtfs_realtime_pb2.FeedMessage()

    response = requests.get(ALERTS_URL, timeout=10)
    response.raise_for_status()

    feed.ParseFromString(response.content)

    alerts = []

    for entity in feed.entity:
        if not entity.HasField("alert"):
            continue

        alert = entity.alert

        header = ""
        description = ""

        if alert.header_text.translation:
            header = alert.header_text.translation[0].text

        if alert.description_text.translation:
            description = alert.description_text.translation[0].text

        routes = []

        for informed_entity in alert.informed_entity:
            if informed_entity.route_id:
                routes.append(str(informed_entity.route_id))

        alerts.append(
            {
                "header": header,
                "description": description,
                "routes": routes,
            }
        )

    return alerts


def classify_alert_severity(alert_text: str):
    text = alert_text.lower()

    if any(keyword in text for keyword in ADVISORY_KEYWORDS):
        return "Advisory", 0

    if any(keyword in text for keyword in HIGH_SEVERITY_KEYWORDS):
        return "High", 3

    if any(keyword in text for keyword in MEDIUM_SEVERITY_KEYWORDS):
        return "Medium", 2

    return "Low", 1


def mentions_path_station(alert_text: str, path: list[str]):
    text = alert_text.lower()

    for station in path:
        pattern = r"\b" + re.escape(station.lower()) + r"\b"

        if re.search(pattern, text):
            return True

    return False


def mentions_route_line(alert_text: str, route_lines: list[str]):
    text = alert_text.lower()

    for line in route_lines:
        line_number = line.replace("Line ", "").strip()

        if f"line {line_number}" in text:
            return True

    return False


def is_subway_alert(alert_text: str):
    text = alert_text.lower()

    subway_keywords = [
        "line 1",
        "line 2",
        "line 4",
        "subway",
        "station",
        "platform",
        "elevator",
        "escalator",
    ]

    return any(keyword in text for keyword in subway_keywords)


def is_service_disruption(alert_text: str):
    text = alert_text.lower()

    disruption_keywords = HIGH_SEVERITY_KEYWORDS + MEDIUM_SEVERITY_KEYWORDS

    return any(keyword in text for keyword in disruption_keywords)


def score_live_delay_risk(route_lines: list[str], path: list[str]):
    try:
        alerts = get_live_alerts()
    except Exception as error:
        return {
            "delayRisk": "Unknown",
            "liveAlertCount": 0,
            "liveAlerts": [],
            "liveReason": f"Could not fetch live TTC alerts: {error}",
        }

    matched_alerts = []

    for alert in alerts:
        alert_text = f"{alert['header']} {alert['description']}"

        subway_alert = is_subway_alert(alert_text)
        station_match = mentions_path_station(alert_text, path)
        line_match = mentions_route_line(alert_text, route_lines)
        service_disruption = is_service_disruption(alert_text)

        is_relevant = subway_alert and (
            station_match or (line_match and service_disruption)
        )

        if not is_relevant:
            continue

        severity, score = classify_alert_severity(alert_text)

        matched_alerts.append(
            {
                "header": alert["header"],
                "description": alert["description"],
                "routes": alert["routes"],
                "severity": severity,
                "score": score,
            }
        )

    total_score = sum(alert["score"] for alert in matched_alerts)

    if total_score >= 3:
        risk = "High"
    elif total_score >= 2:
        risk = "Medium"
    elif total_score >= 1:
        risk = "Low"
    else:
        risk = "Low"

    delay_alerts = [alert for alert in matched_alerts if alert["score"] > 0]
    advisory_alerts = [alert for alert in matched_alerts if alert["score"] == 0]

    if delay_alerts:
        live_reason = (
            f"{len(delay_alerts)} delay-related live TTC alert(s) found along this route."
        )
    elif advisory_alerts:
        live_reason = (
            f"{len(advisory_alerts)} station advisory alert(s) found along this route, "
            f"but no delay-related alerts."
        )
    else:
        live_reason = "No relevant live TTC alerts found along this route."

    return {
        "delayRisk": risk,
        "liveAlertCount": len(matched_alerts),
        "liveAlerts": matched_alerts[:3],
        "liveReason": live_reason,
    }