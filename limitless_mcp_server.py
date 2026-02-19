#!/usr/bin/env python3
"""
Limitless AI Pendant MCP Server

Exposes your Limitless pendant lifelogs as tools queryable from Claude.
Requires LIMITLESS_API_KEY environment variable.
"""

import os
import sys
import json
import asyncio
from datetime import datetime, timezone
from typing import Any

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

API_BASE = "https://api.limitless.ai/v1"
API_KEY_ENV = "LIMITLESS_API_KEY"


def get_api_key() -> str:
    key = os.environ.get(API_KEY_ENV, "").strip()
    if not key:
        print(
            f"ERROR: {API_KEY_ENV} environment variable not set.",
            file=sys.stderr,
        )
        sys.exit(1)
    return key


def auth_headers() -> dict[str, str]:
    return {"X-API-Key": get_api_key(), "Content-Type": "application/json"}


async def limitless_get(path: str, params: dict | None = None) -> dict:
    """Make an authenticated GET request to the Limitless API."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{API_BASE}{path}",
            headers=auth_headers(),
            params={k: v for k, v in (params or {}).items() if v is not None},
        )
        if resp.status_code == 401:
            raise ValueError("Invalid API key. Check your LIMITLESS_API_KEY.")
        if resp.status_code == 429:
            raise ValueError("Rate limit exceeded (180 req/min). Try again shortly.")
        if resp.status_code == 404:
            raise ValueError(f"Resource not found: {path}")
        resp.raise_for_status()
        return resp.json()


def format_lifelog(log: dict, include_contents: bool = True) -> str:
    """Format a single lifelog into readable text."""
    lines = []
    lines.append(f"### {log.get('title', 'Untitled')}")
    lines.append(f"**ID:** `{log.get('id', '?')}`")

    start = log.get("startTime", "")
    end = log.get("endTime", "")
    if start:
        lines.append(f"**Time:** {start} → {end or '?'}")

    if log.get("isStarred"):
        lines.append("**Starred:** Yes")

    markdown = log.get("markdown", "")
    if markdown and include_contents:
        lines.append("\n**Transcript:**")
        lines.append(markdown)
    elif include_contents:
        contents = log.get("contents", [])
        if contents:
            lines.append("\n**Contents:**")
            for block in contents:
                btype = block.get("type", "")
                text = block.get("text", "").strip()
                speaker = block.get("speakerName", "")
                if not text:
                    continue
                if btype == "heading1":
                    lines.append(f"\n# {text}")
                elif btype == "heading2":
                    lines.append(f"\n## {text}")
                elif btype == "blockquote":
                    prefix = f"**{speaker}:** " if speaker else ""
                    lines.append(f"> {prefix}{text}")
                else:
                    lines.append(text)

    return "\n".join(lines)


server = Server("limitless-pendant")


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="list_lifelogs",
            description=(
                "List lifelogs from your Limitless pendant. "
                "Filter by date, time range, or get recent recordings. "
                "Returns titles, timestamps, and transcripts."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Filter by date in YYYY-MM-DD format (e.g. '2025-03-15'). Defaults to today if omitted.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max number of lifelogs to return (1–100, default 20).",
                        "minimum": 1,
                        "maximum": 100,
                        "default": 20,
                    },
                    "cursor": {
                        "type": "string",
                        "description": "Pagination cursor from a previous response's nextCursor field.",
                    },
                    "timezone": {
                        "type": "string",
                        "description": "Timezone for date filtering (e.g. 'America/New_York'). Defaults to UTC.",
                        "default": "UTC",
                    },
                    "direction": {
                        "type": "string",
                        "enum": ["asc", "desc"],
                        "description": "Sort order. 'desc' = newest first (default), 'asc' = oldest first.",
                        "default": "desc",
                    },
                    "is_starred": {
                        "type": "boolean",
                        "description": "If true, return only starred lifelogs.",
                    },
                    "include_markdown": {
                        "type": "boolean",
                        "description": "Include full markdown transcript in results (default true).",
                        "default": True,
                    },
                },
                "required": [],
            },
        ),
        types.Tool(
            name="get_lifelog",
            description=(
                "Retrieve a single lifelog by its ID. "
                "Returns the full transcript, speaker labels, and metadata."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "The lifelog ID (from list_lifelogs results).",
                    },
                    "include_markdown": {
                        "type": "boolean",
                        "description": "Include full markdown transcript (default true).",
                        "default": True,
                    },
                },
                "required": ["id"],
            },
        ),
        types.Tool(
            name="get_todays_lifelogs",
            description=(
                "Shortcut to get today's pendant recordings. "
                "Returns all lifelogs from the current day, newest first."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "timezone": {
                        "type": "string",
                        "description": "Your local timezone (e.g. 'America/Chicago'). Defaults to UTC.",
                        "default": "UTC",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max results to return (default 50).",
                        "default": 50,
                    },
                },
                "required": [],
            },
        ),
        types.Tool(
            name="get_recent_lifelogs",
            description=(
                "Get the most recent pendant recordings across all dates, "
                "without filtering by a specific day."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Number of recent lifelogs to fetch (default 10, max 100).",
                        "default": 10,
                        "maximum": 100,
                    },
                    "cursor": {
                        "type": "string",
                        "description": "Pagination cursor from a previous response.",
                    },
                },
                "required": [],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[types.TextContent]:
    try:
        if name == "list_lifelogs":
            params = {
                "date": arguments.get("date"),
                "limit": arguments.get("limit", 20),
                "cursor": arguments.get("cursor"),
                "timezone": arguments.get("timezone", "UTC"),
                "direction": arguments.get("direction", "desc"),
                "includeMarkdown": str(arguments.get("include_markdown", True)).lower(),
            }
            if arguments.get("is_starred") is not None:
                params["isStarred"] = str(arguments["is_starred"]).lower()

            data = await limitless_get("/lifelogs", params)
            lifelogs = data.get("data", {}).get("lifelogs", [])
            meta = data.get("meta", {}).get("lifelogs", {})

            if not lifelogs:
                return [types.TextContent(type="text", text="No lifelogs found for the given filters.")]

            parts = [f"**Found {len(lifelogs)} lifelog(s)**"]
            next_cursor = meta.get("nextCursor")
            if next_cursor:
                parts.append(f"_More results available — use cursor: `{next_cursor}`_")
            parts.append("")

            for log in lifelogs:
                parts.append(format_lifelog(log))
                parts.append("\n---\n")

            return [types.TextContent(type="text", text="\n".join(parts))]

        elif name == "get_lifelog":
            lifelog_id = arguments["id"]
            include_md = arguments.get("include_markdown", True)
            params = {"includeMarkdown": str(include_md).lower()}
            data = await limitless_get(f"/lifelogs/{lifelog_id}", params)
            log = data.get("data", {}).get("lifelog", data.get("lifelog", data))
            return [types.TextContent(type="text", text=format_lifelog(log))]

        elif name == "get_todays_lifelogs":
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            tz = arguments.get("timezone", "UTC")
            limit = arguments.get("limit", 50)
            params = {
                "date": today,
                "limit": limit,
                "timezone": tz,
                "direction": "desc",
                "includeMarkdown": "true",
            }
            data = await limitless_get("/lifelogs", params)
            lifelogs = data.get("data", {}).get("lifelogs", [])
            meta = data.get("meta", {}).get("lifelogs", {})

            if not lifelogs:
                return [types.TextContent(type="text", text=f"No recordings found for today ({today}).")]

            parts = [f"**Today's recordings ({today}) — {len(lifelogs)} lifelog(s)**"]
            next_cursor = meta.get("nextCursor")
            if next_cursor:
                parts.append(f"_More available — cursor: `{next_cursor}`_")
            parts.append("")

            for log in lifelogs:
                parts.append(format_lifelog(log))
                parts.append("\n---\n")

            return [types.TextContent(type="text", text="\n".join(parts))]

        elif name == "get_recent_lifelogs":
            params = {
                "limit": arguments.get("limit", 10),
                "cursor": arguments.get("cursor"),
                "direction": "desc",
                "includeMarkdown": "true",
            }
            data = await limitless_get("/lifelogs", params)
            lifelogs = data.get("data", {}).get("lifelogs", [])
            meta = data.get("meta", {}).get("lifelogs", {})

            if not lifelogs:
                return [types.TextContent(type="text", text="No recent lifelogs found.")]

            parts = [f"**{len(lifelogs)} most recent lifelog(s)**"]
            next_cursor = meta.get("nextCursor")
            if next_cursor:
                parts.append(f"_More available — cursor: `{next_cursor}`_")
            parts.append("")

            for log in lifelogs:
                parts.append(format_lifelog(log))
                parts.append("\n---\n")

            return [types.TextContent(type="text", text="\n".join(parts))]

        else:
            return [types.TextContent(type="text", text=f"Unknown tool: {name}")]

    except ValueError as e:
        return [types.TextContent(type="text", text=f"Error: {e}")]
    except httpx.HTTPStatusError as e:
        return [types.TextContent(type="text", text=f"API error {e.response.status_code}: {e.response.text}")]
    except Exception as e:
        return [types.TextContent(type="text", text=f"Unexpected error: {e}")]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
