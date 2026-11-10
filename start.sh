#!/usr/bin/env bash
# Start frontend (no auth) + mock telemetry server. Stop with ./stop.sh
cd "$(dirname "$0")"
[ -d frontend/node_modules ] || (cd frontend && npm ci)
make ui
python3 tools/mock_server.py > mock.log 2>&1 & echo $! > mock.pid
echo "Mock data server running (log: mock.log)"
