#!/usr/bin/env python3
"""Static file server for local preview.

`python3 -m http.server` cannot be used here: its __main__ block evaluates
os.getcwd() at import time, which raises PermissionError when the launcher
starts the process in a directory it cannot stat. This module never touches
the working directory — the root is passed in explicitly.

    python3 tools/serve.py <absolute-root> [port]
"""
import functools
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class Handler(SimpleHTTPRequestHandler):
    """Adds the content types GitHub Pages serves but Python's map omits."""

    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".avif": "image/avif",
        ".webp": "image/webp",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
        ".mjs": "text/javascript",
        ".js": "text/javascript",
    }

    def end_headers(self):
        # Local preview should always reflect the file on disk.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("usage: serve.py <absolute-root> [port]")
    root = sys.argv[1]
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 4173
    if not os.path.isdir(root):
        sys.exit(f"not a directory: {root}")

    handler = functools.partial(Handler, directory=root)
    server = HTTPServer(("127.0.0.1", port), handler)
    print(f"serving {root} on http://127.0.0.1:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
