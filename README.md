# Limitless Pendant → Claude Integration

Query your [Limitless AI pendant](https://www.limitless.ai/developers) lifelogs directly from a Claude Code chat session using MCP (Model Context Protocol).

---

## How It Works

An MCP server (`limitless_mcp_server.py`) runs alongside Claude Code and exposes your pendant data as callable tools. Claude can then retrieve, summarize, and analyze your recordings on request.

```
Claude Code  ──MCP──►  limitless_mcp_server.py  ──HTTPS──►  api.limitless.ai
```

---

## Setup

### 1. Get your API key

Open the Limitless Desktop or Web App, go to the **Developer** section, and copy your API key.

### 2. Run setup

```bash
chmod +x setup.sh
./setup.sh
```

This creates a `.venv`, installs dependencies, and copies `.env.example` → `.env`.

### 3. Add your API key to `.env`

```bash
# Edit .env
LIMITLESS_API_KEY=lmt_your_actual_key_here
```

Run `./setup.sh` again to confirm everything is configured correctly.

### 4. Start Claude Code in this directory

```bash
claude
```

The MCP server starts automatically. Claude will have access to your pendant tools.

---

## Available Tools

Once running, Claude can use these tools when you ask:

| Tool | What it does |
|------|-------------|
| `get_todays_lifelogs` | All of today's pendant recordings |
| `list_lifelogs` | Lifelogs for a specific date, with optional filters |
| `get_recent_lifelogs` | Most recent recordings across all dates |
| `get_lifelog` | Full transcript for a specific lifelog ID |

### Example prompts

```
What did I record today on my pendant?
Show me my recordings from March 15th, 2025
What were the last 5 things I captured?
Get the full transcript for lifelog ID abc123
Show me only my starred lifelogs from yesterday
```

---

## Files

```
.
├── limitless_mcp_server.py   # MCP server (the core integration)
├── run_server.sh             # Launcher (sources .env, activates venv)
├── setup.sh                  # One-time setup script
├── requirements.txt          # Python deps (mcp, httpx)
├── .env.example              # API key template
├── .env                      # Your actual key (gitignored)
└── .claude/
    └── settings.json         # Registers MCP server with Claude Code
```

---

## Security Notes

- `.env` is gitignored — your API key stays local
- Never commit your actual API key
- The Limitless API key is only sent to `api.limitless.ai` over HTTPS
- Rate limit: 180 requests/minute per key

---

## Troubleshooting

**"LIMITLESS_API_KEY environment variable not set"**
→ Make sure `.env` exists with your key and you ran `./setup.sh`

**"Invalid API key"**
→ Double-check the key in `.env` matches what's shown in the Limitless app

**MCP server not showing up in Claude**
→ Restart Claude Code; the server must be running in the project directory

**No lifelogs returned**
→ Your pendant must be paired and have synced recordings. Check the Limitless app directly.

---

## API Reference

- [Limitless Developer Platform](https://www.limitless.ai/developers)
- [Limitless API Help Center](https://help.limitless.ai/en/articles/11106060-limitless-api)
- [API Examples (GitHub)](https://github.com/limitless-ai-inc/limitless-api-examples)
