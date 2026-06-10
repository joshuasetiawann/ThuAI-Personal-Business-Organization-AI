#!/usr/bin/env bash
# ── Thunity — double-clickable Mac launcher ────────────────────────────
# Finder double-click entry point. Opens in Terminal, runs the Mac start
# script, and keeps the window open afterward so you can read any messages.
# This is a thin wrapper — all logic lives in start_thunity_mac.sh.
cd "$(dirname "$0")/.." || exit 1
echo "Thunity launcher — repo: $(pwd)"
echo
bash "scripts/start_thunity_mac.sh"
STATUS=$?
echo
echo "── start_thunity_mac.sh exited with status $STATUS ──"
echo "You can close this window. (Docker services may still be running.)"
echo "Press Return to close."
read -r _
