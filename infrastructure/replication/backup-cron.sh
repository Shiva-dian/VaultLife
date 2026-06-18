#!/bin/bash
# ============================================================
# backup-cron.sh — Daily backup job on STANDBY server
# Runs at 02:00 AM standby local time (night = off-peak)
# Zero impact on primary server performance
# ============================================================
set -e

# ── Config ────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETAIN_DAYS="${BACKUP_RETAIN:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_LABEL=$(date +%Y-%m-%d)
BACKUP_FILE="$BACKUP_DIR/vaultlife_backup_${TIMESTAMP}.sql.gz"
LATEST_LINK="$BACKUP_DIR/latest.sql.gz"
LOG_FILE="/var/log/backup.log"

# DB connection
DB_HOST="${PGHOST:-standby}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${POSTGRES_DB:-vaultlife_db}"
DB_USER="${POSTGRES_USER:-vaultlife_user}"

echo "======================================================" | tee -a "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] VaultLife Backup Started" | tee -a "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Source: ${DB_HOST}:${DB_PORT}/${DB_NAME}" | tee -a "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Target: ${BACKUP_FILE}" | tee -a "$LOG_FILE"

# ── Ensure backup directory exists ───────────────────────────
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"
mkdir -p "$BACKUP_DIR/monthly"

# ── Check standby is in sync before backing up ───────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking replication lag..." | tee -a "$LOG_FILE"

LAG=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c \
  "SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::INTEGER;" 2>/dev/null || echo "999999")
LAG=$(echo "$LAG" | tr -d ' ')

if [ "$LAG" -gt 300 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  WARNING: Replication lag is ${LAG}s (>5min). Backup may be slightly stale." | tee -a "$LOG_FILE"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Replication lag: ${LAG}s (acceptable)" | tee -a "$LOG_FILE"
fi

# ── Run pg_dump from standby (read-only — zero primary impact) ─
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running pg_dump..." | tee -a "$LOG_FILE"
START_TIME=$(date +%s)

pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --format=custom \
  --compress=9 \
  --no-password \
  --verbose \
  --file="$BACKUP_FILE" \
  2>> "$LOG_FILE"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ pg_dump complete in ${DURATION}s — Size: ${SIZE}" | tee -a "$LOG_FILE"

# ── Update symlink to latest backup ──────────────────────────
ln -sf "$BACKUP_FILE" "$LATEST_LINK"

# ── Weekly backup (every Sunday) ─────────────────────────────
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
if [ "$DAY_OF_WEEK" -eq 7 ]; then
  WEEKLY_FILE="$BACKUP_DIR/weekly/vaultlife_weekly_${DATE_LABEL}.sql.gz"
  cp "$BACKUP_FILE" "$WEEKLY_FILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📦 Weekly backup saved: $WEEKLY_FILE" | tee -a "$LOG_FILE"
fi

# ── Monthly backup (1st of month) ─────────────────────────────
DAY_OF_MONTH=$(date +%d)
if [ "$DAY_OF_MONTH" -eq 1 ]; then
  MONTHLY_FILE="$BACKUP_DIR/monthly/vaultlife_monthly_$(date +%Y-%m).sql.gz"
  cp "$BACKUP_FILE" "$MONTHLY_FILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🗄️  Monthly backup saved: $MONTHLY_FILE" | tee -a "$LOG_FILE"
fi

# ── Verify backup integrity ───────────────────────────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verifying backup integrity..." | tee -a "$LOG_FILE"
if pg_restore --list "$BACKUP_FILE" > /dev/null 2>&1; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Backup integrity verified" | tee -a "$LOG_FILE"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ BACKUP INTEGRITY CHECK FAILED!" | tee -a "$LOG_FILE"
  exit 1
fi

# ── Cleanup old daily backups ─────────────────────────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning up backups older than ${RETAIN_DAYS} days..." | tee -a "$LOG_FILE"
DELETED=$(find "$BACKUP_DIR" -maxdepth 1 -name "vaultlife_backup_*.sql.gz" \
  -mtime "+${RETAIN_DAYS}" -delete -print | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deleted ${DELETED} old backup(s)" | tee -a "$LOG_FILE"

# Keep only 12 weekly backups
find "$BACKUP_DIR/weekly" -name "*.sql.gz" | sort | head -n -12 | xargs -r rm
# Keep only 12 monthly backups
find "$BACKUP_DIR/monthly" -name "*.sql.gz" | sort | head -n -12 | xargs -r rm

# ── Write backup manifest ─────────────────────────────────────
MANIFEST="$BACKUP_DIR/backup_manifest.json"
cat > "$MANIFEST" << JSONEOF
{
  "last_backup": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "backup_file": "${BACKUP_FILE}",
  "size":        "${SIZE}",
  "duration_seconds": ${DURATION},
  "replication_lag_seconds": ${LAG},
  "db_name":     "${DB_NAME}",
  "status":      "success",
  "daily_count": $(find "$BACKUP_DIR" -maxdepth 1 -name "vaultlife_backup_*.sql.gz" | wc -l),
  "weekly_count": $(find "$BACKUP_DIR/weekly" -name "*.sql.gz" | wc -l),
  "monthly_count": $(find "$BACKUP_DIR/monthly" -name "*.sql.gz" | wc -l)
}
JSONEOF

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Manifest updated: $MANIFEST" | tee -a "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Backup job complete" | tee -a "$LOG_FILE"
echo "======================================================" | tee -a "$LOG_FILE"
