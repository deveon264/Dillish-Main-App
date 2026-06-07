#!/bin/bash
set -e

# Runs automatically after a task is merged. Keep it idempotent and
# non-interactive (stdin is closed). Installs any new/changed dependencies
# so the merged code runs. This project uses npm (package-lock.json) and has
# no database migrations (Postgres is accessed directly), so install is enough.
npm install --no-audit --no-fund
