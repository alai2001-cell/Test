"""WHOOP OAuth2 authentication flow and token management."""

import json
import os
import secrets
import time
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlencode, urlparse, parse_qs

import httpx
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent
TOKENS_FILE = BASE_DIR / "tokens.json"

CLIENT_ID = os.environ.get("WHOOP_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("WHOOP_CLIENT_SECRET", "")
REDIRECT_URI = os.environ.get("WHOOP_REDIRECT_URI", "http://localhost:8765/callback")

AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth"
TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token"
SCOPES = "read:sleep read:cycles read:recovery read:workout offline"


def _save_tokens(token_data: dict) -> None:
    """Save tokens to disk with an expires_at timestamp."""
    token_data["expires_at"] = time.time() + token_data.get("expires_in", 3600)
    TOKENS_FILE.write_text(json.dumps(token_data, indent=2))
    print(f"Tokens saved to {TOKENS_FILE}")


def _load_tokens() -> dict | None:
    """Load tokens from disk, or return None if not found."""
    if not TOKENS_FILE.exists():
        return None
    return json.loads(TOKENS_FILE.read_text())


def _refresh_token(tokens: dict) -> dict:
    """Refresh the access token using the refresh token."""
    resp = httpx.post(
        TOKEN_URL,
        data={
            "grant_type": "refresh_token",
            "refresh_token": tokens["refresh_token"],
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    resp.raise_for_status()
    new_tokens = resp.json()
    # Preserve refresh token if not returned in response
    if "refresh_token" not in new_tokens:
        new_tokens["refresh_token"] = tokens["refresh_token"]
    _save_tokens(new_tokens)
    return new_tokens


def get_valid_token() -> str:
    """Return a valid access token, refreshing if needed.

    Raises RuntimeError if no tokens exist (run whoop_auth.py first).
    """
    tokens = _load_tokens()
    if tokens is None:
        raise RuntimeError(
            "No tokens found. Run 'python whoop_auth.py' to authenticate first."
        )

    # Refresh if expired (with 60-second buffer)
    if time.time() >= tokens.get("expires_at", 0) - 60:
        print("Access token expired, refreshing...")
        tokens = _refresh_token(tokens)

    return tokens["access_token"]


def run_auth_flow() -> None:
    """Run the full OAuth2 authorization code flow.

    1. Opens the browser to the WHOOP authorization page
    2. Starts a local HTTP server to capture the callback
    3. Exchanges the authorization code for tokens
    4. Saves tokens to tokens.json
    """
    if not CLIENT_ID or not CLIENT_SECRET:
        print("Error: WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET must be set.")
        print("Copy .env.example to .env and fill in your credentials.")
        print("Get them from https://developer.whoop.com")
        return

    state = secrets.token_urlsafe(32)
    auth_code = None
    received_state = None

    class CallbackHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            nonlocal auth_code, received_state
            query = parse_qs(urlparse(self.path).query)

            if "error" in query:
                error = query["error"][0]
                self.send_response(400)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(
                    f"<h1>Authorization Failed</h1><p>{error}</p>".encode()
                )
                return

            auth_code = query.get("code", [None])[0]
            received_state = query.get("state", [None])[0]

            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(
                b"<h1>Authorization Successful!</h1>"
                b"<p>You can close this window and return to the terminal.</p>"
            )

        def log_message(self, format, *args):
            pass  # Suppress HTTP server logs

    # Build authorization URL
    params = {
        "client_id": CLIENT_ID,
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPES,
        "state": state,
    }
    authorize_url = f"{AUTH_URL}?{urlencode(params)}"

    # Parse port from redirect URI
    parsed = urlparse(REDIRECT_URI)
    port = parsed.port or 8765

    server = HTTPServer(("localhost", port), CallbackHandler)
    server.timeout = 120  # 2 minute timeout

    print(f"Opening browser for WHOOP authorization...")
    print(f"If the browser doesn't open, visit:\n{authorize_url}\n")
    webbrowser.open(authorize_url)

    print("Waiting for authorization callback...")
    server.handle_request()
    server.server_close()

    if not auth_code:
        print("Error: No authorization code received.")
        return

    if received_state != state:
        print("Error: State mismatch — possible CSRF attack.")
        return

    # Exchange authorization code for tokens
    print("Exchanging authorization code for tokens...")
    resp = httpx.post(
        TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": auth_code,
            "redirect_uri": REDIRECT_URI,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    if resp.status_code != 200:
        print(f"Error exchanging code: {resp.status_code}")
        print(resp.text)
        return

    token_data = resp.json()
    _save_tokens(token_data)
    print("Authentication successful! You can now run whoop_pull.py to fetch data.")


if __name__ == "__main__":
    run_auth_flow()
