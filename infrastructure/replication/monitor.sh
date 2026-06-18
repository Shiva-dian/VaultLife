#!/bin/bash
# ============================================================
# monitor.sh — Replication health monitor
# Runs every 60s — alerts if lag exceeds threshold
# ============================================================

PRIMARY_HOST="${PRIMARY_HOST:-primary}"
DB_USER="${POSTGRES_USER:-vaultlife_user}"
DB_NAME="${POSTGRES_DB:-vaultlife_db}"
LAG_WARN=60       # seconds — warn if lag > 1 min
LAG_CRIT=300      # seconds — critical if lag > 5 min
LOG="/var/log/replication_monitor.log"
STATUS_FILE="/tmp/repl_status.json"

timestamp() { date '+%Y-%m-%d %H:%M:%S'; }

# ── Query primary for replication status ─────────────────────
PRIMARY_STATUS=$(psql -h "$PRIMARY_HOST" -U "$DB_USER" -d "$DB_NAME" -t -A -F'|' -c \
  "SELECT
     client_addr,
     application_name,
     state,
     sync_state,
     EXTRACT(EPOCH FROM write_lag)::INTEGER  AS write_lag_s,
     EXTRACT(EPOCH FROM flush_lag)::INTEGER  AS flush_lag_s,
     EXTRACT(EPOCH FROM replay_lag)::INTEGER AS replay_lag_s,
     pg_wal_lsn_diff(sent_lsn, replay_lsn) AS bytes_behind
   FROM pg_stat_replication
   ORDER BY client_addr;" 2>/dev/null)

# ── Query standby for its own lag ────────────────────────────
STANDBY_LAG=$(psql -h standby -U "$DB_USER" -d "$DB_NAME" -t -c \
  "SELECT COALESCE(
     EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::INTEGER,
     -1
   );" 2>/dev/null | tr -d ' ')

IS_RECOVERING=$(psql -h standby -U "$DB_USER" -d "$DB_NAME" -t -c \
  "SELECT pg_is_in_recovery();" 2>/dev/null | tr -d ' ')

# ── Evaluate status ───────────────────────────────────────────
if [ -z "$STANDBY_LAG" ] || [ "$STANDBY_LAG" = "-1" ]; then
  STATUS="UNKNOWN"
  COLOR="⚪"
elif [ "$STANDBY_LAG" -ge "$LAG_CRIT" ]; then
  STATUS="CRITICAL"
  COLOR="🔴"
elif [ "$STANDBY_LAG" -ge "$LAG_WARN" ]; then
  STATUS="WARNING"
  COLOR="🟡"
else
  STATUS="OK"
  COLOR="🟢"
fi

# ── Log ───────────────────────────────────────────────────────
echo "[$(timestamp)] ${COLOR} Replication status: ${STATUS} | Lag: ${STANDBY_LAG}s | In-recovery: ${IS_RECOVERING}" | tee -a "$LOG"

if [ -n "$PRIMARY_STATUS" ]; then
  echo "[$(timestamp)]    Primary sees: $PRIMARY_STATUS" | tee -a "$LOG"
fi

# ── Write JSON status file ────────────────────────────────────
cat > "$STATUS_FILE" << EOF
{
  "checked_at":      "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status":          "${STATUS}",
  "lag_seconds":     ${STANDBY_LAG:-null},
  "is_recovering":   ${IS_RECOVERING:-false},
  "warn_threshold":  ${LAG_WARN},
  "crit_threshold":  ${LAG_CRIT},
  "primary_host":    "${PRIMARY_HOST}"
}
EOF

# ── Alert on critical ─────────────────────────────────────────
if [ "$STATUS" = "CRITICAL" ]; then
  echo "[$(timestamp)] ❌ CRITICAL: Replication lag ${STANDBY_LAG}s exceeds ${LAG_CRIT}s threshold!" | tee -a "$LOG"
  # Uncomment to send webhook alert:
  # curl -s -X POST "${ALERT_WEBHOOK_URL}" \
  #   -H "Content-Type: application/json" \
  #   -d "{\"text\":\"VaultLife DB replication CRITICAL: lag=${STANDBY_LAG}s\"}" || true
fi

if [ "$STATUS" = "WARNING" ]; then
  echo "[$(timestamp)] ⚠️  WARNING: Replication lag ${STANDBY_LAG}s exceeds ${LAG_WARN}s threshold" | tee -a "$LOG"
fi
