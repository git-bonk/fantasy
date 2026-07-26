#!/bin/sh
set -e

# cron does not inherit the container environment, so persist the variables the
# ingest job needs into a file that the crontab sources before each run.
env | grep -E '^(ESPN_LEAGUE_ID|ESPN_S2|SWID|SEASONS|DB_PATH)=' > /etc/fantasynfl.env || true
chmod 600 /etc/fantasynfl.env

DB="${DB_PATH:-/data/fantasynfl.db}"

# Remove any leftover sample data once real data exists.
cleanup_sample() {
  python3 -c "
import sqlite3, sys
conn = sqlite3.connect('$DB')
cur = conn.cursor()
cur.execute(\"SELECT COUNT(*) FROM seasons WHERE league_id = 'sample'\")
has_sample = cur.fetchone()[0] > 0
cur.execute(\"SELECT COUNT(*) FROM seasons WHERE league_id != 'sample'\")
has_real = cur.fetchone()[0] > 0
if has_sample and has_real:
    cur.execute(\"DELETE FROM seasons WHERE league_id = 'sample'\")
    # Orphaned rows in child tables are cleaned by FK or manually:
    for tbl in ('teams','weeks','matchups','rosters','transactions',
                'elo_ratings','luck','awards','sos','playoff_snapshots','records'):
        try:
            cur.execute(f'DELETE FROM {tbl} WHERE season_id NOT IN (SELECT id FROM seasons)')
        except Exception:
            pass
    conn.commit()
    print('[fantasynfl] removed sample data (real league data present)')
conn.close()
" 2>/dev/null || true
}

if [ ! -f "$DB" ]; then
  if [ -n "$ESPN_LEAGUE_ID" ] && [ -n "$ESPN_S2" ] && [ -n "$SWID" ]; then
    echo "[fantasynfl] no DB found, ingesting real league from ESPN..."
    fantasynfl ingest && cleanup_sample || {
      echo "[fantasynfl] ESPN ingest failed, falling back to sample data..."
      fantasynfl sample || true
    }
  else
    echo "[fantasynfl] no DB found and no ESPN creds, generating sample season..."
    fantasynfl sample || true
  fi
else
  # DB exists — clean up sample data if real data was ingested since last boot.
  cleanup_sample
fi

echo "[fantasynfl] starting cron (weekly ESPN ingest)..."
exec cron -f
