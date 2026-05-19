import pandas as pd
import numpy as np
import os

def calculate_pulse_scores():
    # Resolve absolute paths to the data files
    base_dir = os.path.dirname(os.path.abspath(__file__))
    intersections_path = os.path.join(base_dir, 'data', 'intersections.csv')
    live_transit_path = os.path.join(base_dir, 'data', 'live_transit.csv')

    # 1. Load Data
    intersections = pd.read_csv(intersections_path)
    live_transit = pd.read_csv(live_transit_path)

    # 2. Merge Datasets
    df = pd.merge(live_transit, intersections, on='intersection_id')

    # 3. Algorithm Constants
    BASE_COST = 500  # Prevents division by zero
    CAR_IMPACT_FACTOR = 0.1 

    # 4. Calculate Pulse Score (Ps)
    numerator = df['passenger_count'] * df['delay_seconds'] * df['routes_served'] * df['congestion_risk']
    denominator = BASE_COST + (df['car_volume'] * CAR_IMPACT_FACTOR)
    
    # Round to 2 decimal places for clean UI display
    df['pulse_score'] = (numerator / denominator).round(2)

    # 5. Recommend Intervention Logic
    conditions = [
        (df['pulse_score'] > 500),
        (df['pulse_score'] > 200),
        (df['pulse_score'] <= 200)
    ]
    interventions = [
        'CRITICAL: Queue-Jump Lane Required',
        'MODERATE: Dynamic Green Extension (+8s)',
        'LOW: Standard Signal Cycle'
    ]
    df['recommended_action'] = np.select(conditions, interventions, default="UNKNOWN")
    # 6. Sort by highest priority
    hotspots = df.sort_values(by='pulse_score', ascending=False).reset_index(drop=True)
    
    return hotspots.to_dict(orient="records")