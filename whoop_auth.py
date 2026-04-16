"""WHOOP OAuth2 authentication flow and token management."""

import json
import os
import secrets
import sys
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


def _exchange_code(code: str) -> None:
    """Exchange an authorization code for tokens."""
    resp = httpx.post(
        TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
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
    _save_tokens(resp.json())
    print("Authentication successful! You can now run whoop_pull.py to fetch data.")


def run_manual_flow() -> None:
    """Run OAuth2 in manual mode — useful for headless environments.

    Prints the auth URL. The user visits it on any device, WHOOP redirects
    to http://localhost:8765/callback?code=... (which fails to load — that's
    fine). The user pastes the full redirect URL back; this script extracts
    the code and exchanges it for tokens.
    """
    if not CLIENT_ID or not CLIENT_SECRET:
        print("Error: WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET must be set in .env")
        return

    state = secrets.token_urlsafe(32)
    params = {
        "client_id": CLIENT_ID,
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPES,
        "state": state,
    }
    authorize_url = f"{AUTH_URL}?{urlencode(params)}"

    print("Manual OAuth flow\n")
    print("1. Open this URL in a browser on any device:\n")
    print(f"   {authorize_url}\n")
    print("2. Log in and authorize the app.")
    print("3. Your browser will try to load http://localhost:8765/callback?code=...")
    print("   (The page will fail to load — that is expected.)")
    print("4. Copy the FULL URL from your browser's address bar and paste below.\n")

    pasted = input("Paste the redirect URL here: ").strip()
    if not pasted:
        print("No URL pasted. Aborting.")
        return

    query = parse_qs(urlparse(pasted).query)
    if "error" in query:
        print(f"Authorization failed: {query['error'][0]}")
        return

    code = query.get("code", [None])[0]
    received_state = query.get("state", [None])[0]

    if not code:
        print("Error: no 'code' parameter found in the URL.")
        return
    if received_state != state:
        print("Warning: state mismatch. Continuing anyway (not recommended in production).")

    print("Exchanging authorization code for tokens...")
    _exchange_code(code)


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
    _exchange_code(auth_code)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--manual":
        run_manual_flow()
    else:
        run_auth_flow()
