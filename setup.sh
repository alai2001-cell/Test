#!/usr/bin/env bash
# One-command setup for the Health Dashboard.
#
# Usage:
#   ./setup.sh         Install deps, generate demo data, open dashboard
#   ./setup.sh real    Install deps, run WHOOP auth flow, pull real data
#   ./setup.sh serve   Just start a local HTTP server for the dashboard

set -euo pipefail

cd "$(dirname "$0")"

MODE="${1:-demo}"

echo "==> Installing Python dependencies..."
pip install -e . --quiet

case "$MODE" in
  demo)
    echo "==> Generating demo data..."
    python demo_data.py
    echo ""
    echo "==> Demo ready."
    echo "    Open index.html in your browser, or run: ./setup.sh serve"
    ;;

  real)
    if [ ! -f .env ]; then
      echo "==> Creating .env from template..."
      cp .env.example .env
      echo ""
      echo "Edit .env and add your WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET."
      echo "Get them from https://developer.whoop.com"
      echo "Then re-run: ./setup.sh real"
      exit 1
    fi

    if [ ! -f tokens.json ]; then
      echo "==> Authenticating with WHOOP (browser will open)..."
      python whoop_auth.py
    fi

    echo "==> Pulling last 30 days of WHOOP data..."
    python whoop_pull.py

    echo ""
    echo "==> Real data loaded."
    echo "    Open index.html in your browser, or run: ./setup.sh serve"
    ;;

  serve)
    PORT="${2:-8080}"
    echo "==> Serving dashboard at http://localhost:${PORT}/"
    echo "    Press Ctrl+C to stop."
    python -m http.server "$PORT"
    ;;

  *)
    echo "Unknown mode: $MODE"
    echo "Usage: $0 [demo|real|serve]"
    exit 1
    ;;
esac
