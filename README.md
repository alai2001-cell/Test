# Health Dashboard

A unified health dashboard with WHOOP API integration and MCP server for Claude.

## Features

- **Limitless Tab**: Pendant lifelog data with search, charts, and speaker analytics
- **WHOOP Tab**: Recovery, sleep, strain, workout data with trend charts
- **MCP Server**: 6 tools for Claude to query your WHOOP data
- **Automated Pipeline**: One script pulls data and generates the dashboard data file

## Quick Start

**Want to preview the dashboard with fake data?**

```bash
./setup.sh demo    # install deps, generate demo data
./setup.sh serve   # start local server at http://localhost:8080
```

Open http://localhost:8080/index.html and click the **WHOOP** tab — you'll see 30 days of realistic demo data with a DEMO badge.

**Ready to use your real WHOOP data?**

```bash
./setup.sh real    # install deps, run OAuth, pull last 30 days
./setup.sh serve
```

You'll need WHOOP developer credentials first (see [Setup](#setup) below).

## Setup

### Prerequisites

- Python 3.10+
- A [WHOOP](https://www.whoop.com) account and device
- A [Limitless](https://www.limitless.ai) API key (for the Limitless tab)

### 1. Register a WHOOP Developer App

1. Go to [developer.whoop.com](https://developer.whoop.com)
2. Sign in with your WHOOP account
3. Create a new application
4. Set the **Redirect URI** to `http://localhost:8765/callback`
5. Note your **Client ID** and **Client Secret**

### 2. Configure Credentials

```bash
cp .env.example .env
```

Edit `.env` and fill in your Client ID and Secret:

```
WHOOP_CLIENT_ID=your_client_id
WHOOP_CLIENT_SECRET=your_client_secret
WHOOP_REDIRECT_URI=http://localhost:8765/callback
```

### 3. Install Dependencies

```bash
pip install -e .
```

### 4. Authenticate with WHOOP

```bash
python whoop_auth.py
```

This opens your browser to log in to WHOOP and authorize the app. Tokens are saved to `tokens.json` (gitignored) and auto-refresh when expired.

**Headless environments** (no browser available):

```bash
python whoop_auth.py --manual
```

This prints an auth URL to visit on any device. After you authorize, WHOOP redirects to `http://localhost:8765/callback?code=...` — that page will fail to load, but the URL contains the code. Copy the full URL from your browser's address bar and paste it back into the script.

### 5. Pull Your Data

```bash
python whoop_pull.py            # Last 30 days (default)
python whoop_pull.py --days 90  # Last 90 days
python whoop_pull.py --all      # All available data
```

This fetches your data and generates `whoop_data.js` for the dashboard.

### 6. View the Dashboard

Open `index.html` in your browser. Click the **WHOOP** tab to see your data.

## MCP Server for Claude

The MCP server lets Claude query your WHOOP data during conversations.

### Register with Claude Code

```bash
claude mcp add whoop \
  -e WHOOP_CLIENT_ID=your_id \
  -e WHOOP_CLIENT_SECRET=your_secret \
  -- python whoop_mcp_server.py
```

Or if working in this repo, the `.mcp.json` file auto-registers it.

### Available Tools

| Tool | Description |
|------|-------------|
| `whoop_summary` | Compact overview of latest metrics |
| `whoop_recovery` | Recovery scores, HRV, resting HR, SpO2 |
| `whoop_sleep` | Sleep duration, stages, efficiency |
| `whoop_workouts` | Workout strain, heart rate zones |
| `whoop_cycles` | Daily strain and calorie data |
| `whoop_refresh` | Pull fresh data from the WHOOP API |

### Example

Ask Claude: *"How has my recovery been trending this week?"*

Claude will call `whoop_recovery(days=7)` and analyze the results.

## File Structure

```
index.html              # Unified Health Dashboard (Limitless + WHOOP tabs)
whoop_auth.py           # OAuth2 authentication flow
whoop_pull.py           # Data fetching + dashboard export
whoop_mcp_server.py     # MCP server (6 tools)
demo_data.py            # Generate fake WHOOP data to preview the dashboard
setup.sh                # One-command setup (demo | real | serve)
pyproject.toml          # Python dependencies
.env.example            # Credential template
.mcp.json               # MCP server registration
data/                   # Cached JSON data (gitignored)
whoop_data.js           # Dashboard data file (auto-generated, gitignored)
tokens.json             # OAuth tokens (auto-generated, gitignored)
```
