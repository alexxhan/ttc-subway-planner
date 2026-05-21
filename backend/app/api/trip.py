from fastapi import APIRouter
from pydantic import BaseModel

from app.services.gtfs_router import find_route

router = APIRouter(prefix="/trip", tags=["Trip Planner"])

class TripRequest(BaseModel):
    start: str
    end: str
    time: str

@router.post("/plan")
def plan_trip(request: TripRequest):
    result = find_route(
        start=request.start,
        end=request.end,
    )

    return {
        "start": request.start,
        "end": request.end,
        "time": request.time,
        **result,
    }