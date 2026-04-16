"""Generate realistic demo WHOOP data so you can preview the dashboard.

Usage:
    python demo_data.py

This creates data/*.json files and whoop_data.js with 30 days of plausible
fake WHOOP data. Use this to see what the dashboard looks like before
setting up real OAuth authentication.

To load real data instead, run:
    python whoop_auth.py
    python whoop_pull.py
"""

import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from whoop_pull import generate_dashboard_js

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)


def iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def generate() -> None:
    now = datetime.now(timezone.utc)
    fetched_at = now.isoformat()
    random.seed(42)

    # Profile
    (DATA_DIR / "profile.json").write_text(json.dumps({
        "fetched_at": fetched_at,
        "user_id": 12345,
        "email": "demo@example.com",
        "first_name": "Demo",
        "last_name": "User",
        "_demo": True,
    }, indent=2))

    # Body measurement
    (DATA_DIR / "body_measurement.json").write_text(json.dumps({
        "fetched_at": fetched_at,
        "height_meter": 1.78,
        "weight_kilogram": 75.5,
        "max_heart_rate": 188,
        "_demo": True,
    }, indent=2))

    recovery_records = []
    sleep_records = []
    cycle_records = []
    workout_records = []

    for days_ago in range(30):
        day = now - timedelta(days=days_ago)
        day_start = day.replace(hour=0, minute=30, second=0, microsecond=0)
        wake_time = day.replace(hour=7, minute=0, second=0, microsecond=0)

        # Recovery
        base = 65 + (15 if days_ago % 7 < 5 else -15)
        recovery_score = max(20, min(99, base + random.randint(-15, 15)))
        hrv = 45 + random.uniform(-15, 25) + (recovery_score - 65) * 0.3
        rhr = 55 + random.randint(-4, 6) - (recovery_score - 65) * 0.05
        spo2 = 96 + random.uniform(0, 3)
        skin_temp = 33.0 + random.uniform(-0.8, 0.8)

        recovery_records.append({
            "cycle_id": 10000 + days_ago,
            "sleep_id": 20000 + days_ago,
            "user_id": 12345,
            "created_at": iso(wake_time),
            "updated_at": iso(wake_time),
            "score_state": "SCORED",
            "score": {
                "user_calibrating": False,
                "recovery_score": recovery_score,
                "resting_heart_rate": round(rhr),
                "hrv_rmssd_milli": round(hrv, 1),
                "spo2_percentage": round(spo2, 1),
                "skin_temp_celsius": round(skin_temp, 1),
            },
        })

        # Sleep
        total_sleep_ms = int((6.5 + random.uniform(-1.0, 1.8)) * 3600000)
        in_bed_ms = total_sleep_ms + int(random.uniform(0.3, 0.8) * 3600000)
        rem_ms = int(total_sleep_ms * random.uniform(0.18, 0.24))
        deep_ms = int(total_sleep_ms * random.uniform(0.14, 0.20))
        light_ms = total_sleep_ms - rem_ms - deep_ms
        efficiency = round((total_sleep_ms / in_bed_ms) * 100, 1)

        sleep_records.append({
            "id": 20000 + days_ago,
            "user_id": 12345,
            "created_at": iso(wake_time),
            "updated_at": iso(wake_time),
            "start": iso(day_start),
            "end": iso(wake_time),
            "timezone_offset": "-05:00",
            "nap": False,
            "score_state": "SCORED",
            "score": {
                "stage_summary": {
                    "total_in_bed_time_milli": in_bed_ms,
                    "total_awake_time_milli": in_bed_ms - total_sleep_ms,
                    "total_sleep_time_milli": total_sleep_ms,
                    "total_light_sleep_time_milli": light_ms,
                    "total_slow_wave_sleep_time_milli": deep_ms,
                    "total_rem_sleep_time_milli": rem_ms,
                    "sleep_cycle_count": random.randint(3, 6),
                    "disturbance_count": random.randint(2, 12),
                },
                "sleep_needed": {
                    "baseline_milli": 28800000,
                    "need_from_sleep_debt_milli": random.randint(0, 3600000),
                    "need_from_recent_strain_milli": random.randint(0, 1800000),
                    "need_from_recent_nap_milli": 0,
                },
                "respiratory_rate": round(14.0 + random.uniform(-1.0, 2.0), 1),
                "sleep_performance_percentage": round(efficiency - random.uniform(0, 10), 1),
                "sleep_consistency_percentage": round(random.uniform(60, 95), 1),
                "sleep_efficiency_percentage": efficiency,
            },
        })

        # Daily cycle (strain)
        strain = round(random.uniform(8.5, 16.5), 1)
        cycle_records.append({
            "id": 10000 + days_ago,
            "user_id": 12345,
            "created_at": iso(day_start),
            "updated_at": iso(wake_time + timedelta(hours=14)),
            "start": iso(day_start),
            "end": iso(day_start + timedelta(days=1)),
            "timezone_offset": "-05:00",
            "score_state": "SCORED",
            "score": {
                "strain": strain,
                "kilojoule": int(strain * 700 + random.randint(-500, 500)),
                "average_heart_rate": random.randint(65, 85),
                "max_heart_rate": random.randint(140, 178),
            },
        })

        # Workouts (not every day)
        if random.random() > 0.4:
            sports = [(0, "Activity"), (1, "Running"), (2, "Cycling"),
                      (3, "Weightlifting"), (43, "Climbing"), (57, "Functional Fitness")]
            sport_id, _ = random.choice(sports)
            wo_start = day_start + timedelta(hours=random.randint(6, 18))
            wo_duration = timedelta(minutes=random.randint(25, 90))
            wo_strain = round(random.uniform(6.0, 15.0), 1)
            zone_total = int(wo_duration.total_seconds() * 1000)
            zones = [random.uniform(0.05, 0.25) for _ in range(6)]
            zone_sum = sum(zones)
            zones = [z / zone_sum for z in zones]

            workout_records.append({
                "id": 30000 + days_ago,
                "user_id": 12345,
                "created_at": iso(wo_start),
                "updated_at": iso(wo_start + wo_duration),
                "start": iso(wo_start),
                "end": iso(wo_start + wo_duration),
                "timezone_offset": "-05:00",
                "sport_id": sport_id,
                "score_state": "SCORED",
                "score": {
                    "strain": wo_strain,
                    "average_heart_rate": random.randint(120, 160),
                    "max_heart_rate": random.randint(160, 185),
                    "kilojoule": int(wo_strain * 180),
                    "percent_recorded": 100,
                    "distance_meter": random.randint(2000, 12000) if sport_id in (1, 2) else None,
                    "altitude_gain_meter": random.randint(10, 200) if sport_id in (1, 2, 43) else None,
                    "altitude_change_meter": None,
                    "zone_duration_zero_milli": int(zone_total * zones[0]),
                    "zone_duration_one_milli": int(zone_total * zones[1]),
                    "zone_duration_two_milli": int(zone_total * zones[2]),
                    "zone_duration_three_milli": int(zone_total * zones[3]),
                    "zone_duration_four_milli": int(zone_total * zones[4]),
                    "zone_duration_five_milli": int(zone_total * zones[5]),
                },
            })

    for filename, records in [
        ("recovery.json", recovery_records),
        ("sleep.json", sleep_records),
        ("cycles.json", cycle_records),
        ("workouts.json", workout_records),
    ]:
        (DATA_DIR / filename).write_text(json.dumps({
            "fetched_at": fetched_at, "count": len(records), "records": records, "_demo": True,
        }, indent=2))

    print(f"Demo data generated in {DATA_DIR}:")
    print(f"  recovery: {len(recovery_records)} records")
    print(f"  sleep:    {len(sleep_records)} records")
    print(f"  cycles:   {len(cycle_records)} records")
    print(f"  workouts: {len(workout_records)} records")
    print(f"  profile + body_measurement")
    print()
    print("Generating whoop_data.js for dashboard...")
    generate_dashboard_js()
    print()
    print("Open index.html in your browser and click the WHOOP tab to preview.")


if __name__ == "__main__":
    generate()
