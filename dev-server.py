#!/usr/bin/env python3
"""Static file server for local preview.

Plain `python3 -m http.server` fails in this project's sandboxed preview
environment: argparse builds its `--directory` default via os.getcwd()
before parsing any args, and that getcwd() call is denied by the sandbox
even though the directory itself is readable. This script serves an
explicit absolute path instead, so it never calls os.getcwd().
"""
import functools
import http.server
import os

PORT = 8815
ROOT = os.path.dirname(os.path.abspath(__file__))

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
http.server.ThreadingHTTPServer.allow_reuse_address = True
with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler) as httpd:
    print(f"Serving {ROOT} at http://127.0.0.1:{PORT}")
    httpd.serve_forever()
