#!/bin/bash
# Casabanka — local server launcher
cd "$(dirname "$0")"
echo ""
echo "  🏠 Casabanka"
echo "  ─────────────────────────────────"
echo "  Open this in your browser:"
echo "  → http://localhost:8080"
echo ""
echo "  Press Ctrl+C to stop."
echo ""
open "http://localhost:8080" 2>/dev/null || true
python3 -m http.server 8080
