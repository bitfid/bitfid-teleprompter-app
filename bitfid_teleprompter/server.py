"""Local server for the Bitfid Teleprompter test app."""

from __future__ import annotations

import argparse
import functools
import http.server
import socket
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = ROOT / "web"


class TeleprompterHandler(http.server.SimpleHTTPRequestHandler):
    """Serve the app shell and static assets from the web directory."""

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def local_ip() -> str:
    """Return the likely LAN IP so phones can open the dev app."""

    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        try:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
        except OSError:
            return "127.0.0.1"


def run(host: str = "0.0.0.0", port: int = 8765) -> None:
    handler = functools.partial(TeleprompterHandler, directory=str(STATIC_DIR))
    server = http.server.ThreadingHTTPServer((host, port), handler)
    lan = local_ip()
    print("Bitfid Teleprompter App")
    print(f"Mac:    http://127.0.0.1:{port}")
    print(f"iPhone: http://{lan}:{port}")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Bitfid Teleprompter App.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    run(args.host, args.port)


if __name__ == "__main__":
    main()
