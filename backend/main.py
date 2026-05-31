from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from engine import calculate_pulse_scores

app = FastAPI(title="PulsePriority API")

# Allow frontend to access this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/hotspots")
def get_hotspots():
    """Returns the ranked list of transit bottlenecks in Debrecen."""
    data = calculate_pulse_scores()
    return {"status": "success", "data": data}

@app.get("/api/hotspots")
def get_hotspots():
    """Returns the ranked list of transit bottlenecks in Debrecen."""
    data = calculate_pulse_scores()
    return {"status": "success", "data": data}
