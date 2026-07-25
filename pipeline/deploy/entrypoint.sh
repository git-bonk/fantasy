#!/bin/sh
set -e

# cron does not inherit the container environment, so persist the variables the
# ingest job needs into a file that the crontab sources before each run.
env | grep -E '^(ESPN_LEAGUE_ID|ESPN_S2|SWID|SEASONS|DB_PATH)=' > /etc/fantasynfl.env || true
chmod 600 /etc/fantasynfl.env

# If no DB exists yet on the shared volume, seed it with a sample season so the
# dashboard has something to show before the first real ingest.
if [ ! -f "${DB_PATH:-/data/fantasynfl.db}" ]; then
  echo "[fantasynfl] no DB found, generating sample season..."
  fantasynfl sample || true
fi

echo "[fantasynfl] starting cron (weekly ESPN ingest)..."
exec cron -f
