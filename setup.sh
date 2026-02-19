#!/usr/bin/env bash
# One-time setup for the Limitless MCP server.
# Run this once before using Claude to query your pendant.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Setting up Limitless MCP server..."

# 1. Create virtualenv
if [ ! -d ".venv" ]; then
    echo "==> Creating Python virtual environment..."
    python3 -m venv .venv
fi

# 2. Install dependencies
echo "==> Installing Python dependencies..."
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r requirements.txt

# 3. Set up .env if not present
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo ""
    echo "==> Created .env from template."
    echo "    Edit .env and set your LIMITLESS_API_KEY, then run this script again."
    echo "    You can find your API key in the Limitless Desktop/Web App → Developer."
    exit 0
fi

# 4. Check that the key is set
source .env
if [ -z "$LIMITLESS_API_KEY" ] || [ "$LIMITLESS_API_KEY" = "your_limitless_api_key_here" ]; then
    echo ""
    echo "ERROR: LIMITLESS_API_KEY is not set in .env"
    echo "       Open .env and replace the placeholder with your real API key."
    exit 1
fi

# 5. Make the launcher executable
chmod +x run_server.sh

echo ""
echo "==> Setup complete!"
echo ""
echo "    Your Limitless pendant tools are now available in Claude."
echo "    Start a Claude Code session in this directory and ask things like:"
echo ""
echo "      'What did I record today on my pendant?'"
echo "      'Show me my most recent lifelogs'"
echo "      'Get lifelogs from 2025-03-15'"
echo ""
