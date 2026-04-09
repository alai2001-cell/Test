"""WHOOP MCP Server — exposes WHOOP health data as tools for Claude."""

import asyncio
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from mcp.server.fastmcp import FastMCP

DATA_DIR = Path(__file__).parent / "data"

mcp = FastMCP(
    "WHOOP",
    instructions="Query WHOOP health data: recovery, sleep, workouts, cycles, and body metrics.",
)


def _load_cached(filename: str) -> dict | None:
    """Load a cached JSON file from the data directory."""
    filepath = DATA_DIR / filename
    if not filepath.exists():
        return None
    return json.loads(filepath.read_text())


def _filter_by_days(records: list[dict], days: int) -> list[dict]:
    """Filter records to only include the last N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_str = cutoff.isoformat()
    filtered = []
    for r in records:
        # WHOOP records use various date fields
        record_date = (
            r.get("start")
            or r.get("created_at")
            or r.get("updated_at")
            or ""
        )
        if record_date >= cutoff_str:
            filtered.append(r)
    return filtered


@mcp.tool()
def whoop_summary() -> dict:
    """Get a compact summary of your latest WHOOP metrics.

    Returns the most recent recovery score, HRV, resting heart rate,
    sleep duration, day strain, and recent workout count.
    """
    summary = {"status": "ok", "data": {}}

    # Recovery
    recovery_data = _load_cached("recovery.json")
    if recovery_data and recovery_data.get("records"):
        latest = recovery_data["records"][0]
        score = latest.get("score", {})
        summary["data"]["recovery"] = {
            "recovery_score": score.get("recovery_score"),
            "hrv_rmssd_milli": score.get("hrv_rmssd_milli"),
            "resting_heart_rate": score.get("resting_heart_rate"),
            "spo2_percentage": score.get("spo2_percentage"),
            "skin_temp_celsius": score.get("skin_temp_celsius"),
        }

    # Sleep
    sleep_data = _load_cached("sleep.json")
    if sleep_data and sleep_data.get("records"):
        latest = sleep_data["records"][0]
        score = latest.get("score", {})
        stage = score.get("stage_summary", {})
        summary["data"]["sleep"] = {
            "total_in_bed_hours": round(
                score.get("total_in_bed_time_milli", 0) / 3600000, 1
            ),
            "total_sleep_hours": round(
                stage.get("total_sleep_time_milli", 0) / 3600000, 1
            ),
            "sleep_efficiency": score.get("sleep_efficiency_percentage"),
            "respiratory_rate": score.get("respiratory_rate"),
        }

    # Cycles / Strain
    cycle_data = _load_cached("cycles.json")
    if cycle_data and cycle_data.get("records"):
        latest = cycle_data["records"][0]
        score = latest.get("score", {})
        summary["data"]["strain"] = {
            "day_strain": score.get("strain"),
            "kilojoule": score.get("kilojoule"),
            "average_heart_rate": score.get("average_heart_rate"),
            "max_heart_rate": score.get("max_heart_rate"),
        }

    # Workouts (count for last 7 days)
    workout_data = _load_cached("workouts.json")
    if workout_data and workout_data.get("records"):
        recent = _filter_by_days(workout_data["records"], 7)
        summary["data"]["workouts_last_7_days"] = len(recent)

    # Data freshness
    if recovery_data:
        summary["data"]["data_fetched_at"] = recovery_data.get("fetched_at")

    if not summary["data"]:
        return {
            "status": "no_data",
            "message": "No cached data found. Run 'python whoop_pull.py' to fetch data.",
        }

    return summary


@mcp.tool()
def whoop_recovery(days: int = 7) -> dict:
    """Get WHOOP recovery data including HRV, resting heart rate, and SpO2.

    Args:
        days: Number of days to retrieve (default: 7)
    """
    data = _load_cached("recovery.json")
    if not data or not data.get("records"):
        return {"error": "No recovery data. Run 'python whoop_pull.py' first."}

    records = _filter_by_days(data["records"], days)
    # Return compact version
    compact = []
    for r in records:
        score = r.get("score", {})
        compact.append({
            "date": r.get("created_at", "")[:10],
            "recovery_score": score.get("recovery_score"),
            "hrv_rmssd_milli": score.get("hrv_rmssd_milli"),
            "resting_heart_rate": score.get("resting_heart_rate"),
            "spo2_percentage": score.get("spo2_percentage"),
            "skin_temp_celsius": score.get("skin_temp_celsius"),
        })

    return {
        "count": len(compact),
        "days": days,
        "fetched_at": data.get("fetched_at"),
        "records": compact,
    }


@mcp.tool()
def whoop_sleep(days: int = 7) -> dict:
    """Get WHOOP sleep data including duration, stages, and efficiency.

    Args:
        days: Number of days to retrieve (default: 7)
    """
    data = _load_cached("sleep.json")
    if not data or not data.get("records"):
        return {"error": "No sleep data. Run 'python whoop_pull.py' first."}

    records = _filter_by_days(data["records"], days)
    compact = []
    for r in records:
        score = r.get("score", {})
        stage = score.get("stage_summary", {})
        compact.append({
            "date": r.get("start", "")[:10],
            "total_sleep_hours": round(
                stage.get("total_sleep_time_milli", 0) / 3600000, 1
            ),
            "total_in_bed_hours": round(
                score.get("total_in_bed_time_milli", 0) / 3600000, 1
            ),
            "sleep_efficiency": score.get("sleep_efficiency_percentage"),
            "rem_hours": round(
                stage.get("total_rem_sleep_time_milli", 0) / 3600000, 1
            ),
            "deep_hours": round(
                stage.get("total_slow_wave_sleep_time_milli", 0) / 3600000, 1
            ),
            "respiratory_rate": score.get("respiratory_rate"),
        })

    return {
        "count": len(compact),
        "days": days,
        "fetched_at": data.get("fetched_at"),
        "records": compact,
    }


@mcp.tool()
def whoop_workouts(days: int = 7) -> dict:
    """Get WHOOP workout data including strain, heart rate zones, and sport type.

    Args:
        days: Number of days to retrieve (default: 7)
    """
    data = _load_cached("workouts.json")
    if not data or not data.get("records"):
        return {"error": "No workout data. Run 'python whoop_pull.py' first."}

    records = _filter_by_days(data["records"], days)
    compact = []
    for r in records:
        score = r.get("score", {})
        compact.append({
            "date": r.get("start", "")[:10],
            "sport_id": r.get("sport_id"),
            "strain": score.get("strain"),
            "average_heart_rate": score.get("average_heart_rate"),
            "max_heart_rate": score.get("max_heart_rate"),
            "kilojoule": score.get("kilojoule"),
            "distance_meter": score.get("distance_meter"),
            "zone_duration_mins": {
                f"zone_{i}": round(
                    score.get(f"zone_duration_{i}_milli", 0) / 60000, 1
                )
                for i in range(6)
                if score.get(f"zone_duration_{i}_milli") is not None
            },
        })

    return {
        "count": len(compact),
        "days": days,
        "fetched_at": data.get("fetched_at"),
        "records": compact,
    }


@mcp.tool()
def whoop_cycles(days: int = 7) -> dict:
    """Get WHOOP physiological cycle data including day strain and calories.

    Args:
        days: Number of days to retrieve (default: 7)
    """
    data = _load_cached("cycles.json")
    if not data or not data.get("records"):
        return {"error": "No cycle data. Run 'python whoop_pull.py' first."}

    records = _filter_by_days(data["records"], days)
    compact = []
    for r in records:
        score = r.get("score", {})
        compact.append({
            "date": r.get("start", "")[:10],
            "strain": score.get("strain"),
            "kilojoule": score.get("kilojoule"),
            "average_heart_rate": score.get("average_heart_rate"),
            "max_heart_rate": score.get("max_heart_rate"),
        })

    return {
        "count": len(compact),
        "days": days,
        "fetched_at": data.get("fetched_at"),
        "records": compact,
    }


@mcp.tool()
def whoop_refresh(days: int = 30) -> dict:
    """Pull fresh data from the WHOOP API and update the local cache.

    This triggers a new data fetch from the WHOOP API, updates all cached
    JSON files, and regenerates the dashboard data file.

    Args:
        days: Number of days to fetch (default: 30)
    """
    try:
        from whoop_pull import pull_all_data

        asyncio.run(pull_all_data(days))
        return {
            "status": "ok",
            "message": f"Successfully pulled {days} days of WHOOP data.",
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


def main():
    mcp.run()


if __name__ == "__main__":
    main()
