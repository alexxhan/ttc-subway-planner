# TTC Subway Planner

A realtime TTC subway route planning application that combines GTFS transit data, live TTC service alerts, and interactive map visualization to compare subway routes across Toronto.

---

## Features

- GTFS-based subway route planning
- Real scheduled travel time estimates
- Live TTC alert integration
- Delay risk classification
- Multiple route options
- Interactive subway map visualization
- TTC-style subway line colors
- Station autocomplete and validation
- Transfer detection
- Dark / light mode UI

---

## Tech Stack

### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- React Leaflet

### Backend
- FastAPI
- Python
- TTC GTFS data
- TTC GTFS-Realtime alerts

---

## Project Structure

```txt
backend/
  app/
    api/
      stations.py
      trip.py

    services/
      gtfs_router.py
      live_ttc_alerts.py

  scripts/
    build_station_dataset.py
    build_subway_graph.py

  main.py

frontend/
  app/
    layout.tsx
    page.tsx

  components/
    RouteMap.tsx

data/
  processed/
    subway_graph.json
    subway_stations.json
```

---

## How It Works

The backend builds a subway graph using TTC GTFS schedule data.

Each subway station is represented as a node, while adjacent stations are connected as weighted edges using scheduled TTC travel times.

When a user selects a starting station and destination station, the backend:

- searches for possible subway paths
- estimates scheduled travel times
- detects transfer stations
- evaluates live TTC service alerts
- classifies live delay risk

The frontend then visualizes the selected route on an interactive subway map and displays:

- route options
- estimated travel time
- station path
- transfer points
- live TTC alerts
- delay risk

---

## Running Locally

### Backend

```bash
cd backend
pip install fastapi uvicorn requests gtfs-realtime-bindings
uvicorn main:app --reload
```

Backend runs at:

```txt
http://127.0.0.1:8000
```

---

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:

```txt
http://localhost:3000
```

---

## Data Notes

Raw TTC GTFS files are not included in this repository because several GTFS files exceed GitHub’s file size limits.

The application instead uses processed GTFS outputs:

```txt
data/processed/subway_graph.json
data/processed/subway_stations.json
```

---

## Future Improvements

- Bus and streetcar integration
- Full multimodal TTC trip planning
- Realtime train arrival predictions
- Realtime vehicle location support
- More advanced route scoring
- Mobile responsive optimization
- Cloud deployment

---

## Screenshots

Screenshots and demo visuals will be added in future updates.