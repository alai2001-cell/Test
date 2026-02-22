# Limitless Pendant Dashboard

A self-contained web dashboard for viewing and exploring data from your [Limitless](https://www.limitless.ai/) pendant.

## Features

- **API Key Authentication** — securely stored in your browser's localStorage
- **Overview Stats** — total lifelogs, recording duration, starred count, unique speakers
- **Activity Chart** — bar + line chart showing recordings and duration over the last 7/14/30 days
- **Speaker Analytics** — top speakers across all your recordings
- **Lifelog Browser** — paginated list with search, date filtering, and starred-only filtering
- **Transcript Viewer** — detailed view with speaker-labeled transcript blocks

## Getting Started

1. Get your API key from [limitless.ai/developers](https://www.limitless.ai/developers)
2. Open `index.html` in your browser
3. Enter your API key and click **Connect**

No build tools, dependencies, or server required — just open the HTML file directly.

## Tech Stack

- Vanilla HTML / CSS / JavaScript
- [Chart.js](https://www.chartjs.org/) (loaded via CDN) for visualizations
- [Limitless Developer API](https://www.limitless.ai/developers) (`https://api.limitless.ai/v1`)

## API Reference

The dashboard uses these Limitless API endpoints:

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/lifelogs` | List lifelogs with date/time range, pagination, search |

Authentication is via the `X-API-Key` header. See the [Limitless API docs](https://help.limitless.ai/en/articles/11106060-limitless-api) for full details.

## Privacy

Your API key never leaves your browser. All API calls are made directly from your browser to `api.limitless.ai`. Nothing is sent to any third-party server.
