import json
from pathlib import Path

from fastapi import APIRouter

router = APIRouter(prefix="/stations", tags=["Stations"])

PROJECT_DIR = Path(__file__).resolve().parents[3]
STATIONS_PATH = PROJECT_DIR / "data" / "processed" / "subway_stations.json"

@router.get("")
def get_stations():
    with open(STATIONS_PATH, "r", encoding="utf-8") as file:
        stations = json.load(file)

    return {"stations": stations}