#!/usr/bin/env bash
cd "$(dirname "$0")"
make ui-stop
[ -f mock.pid ] && kill "$(cat mock.pid)" 2>/dev/null; rm -f mock.pid
echo "Stopped"
