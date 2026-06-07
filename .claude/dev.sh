#!/bin/bash
export PATH="$HOME/.local/node-v22.11.0-darwin-arm64/bin:$PATH"
cd "$(dirname "$0")/.."
exec npm run dev -- --host 127.0.0.1 --port 4321
