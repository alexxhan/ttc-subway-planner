from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.stations import router as stations_router
from app.api.trip import router as trip_router

app = FastAPI(title="TTC Subway Planner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stations_router)
app.include_router(trip_router)


@app.get("/")
def root():
    return {"message": "TTC Subway Planner backend is running"}


@app.get("/health")
def health():
    return {"status": "ok"}