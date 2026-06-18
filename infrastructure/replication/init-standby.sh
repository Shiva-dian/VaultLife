#!/bin/bash
# ============================================================
# init-standby.sh — STANDBY server initialization
# Bootstraps the standby by taking a base backup from primary
# Then sets up streaming replication
# ============================================================
set -e

PGDATA="/var/lib/postgresql/data"
PRIMARY_HOST="${PRIMARY_HOST:-primary}"
PRIMARY_PORT="${PRIMARY_PORT:-5432}"
REPLICATOR_PASSWORD="${REPLICATOR_PASSWORD}"

echo "[VaultLife Standby] ============================================"
echo "[VaultLife Standby] Initializing standby server"
echo "[VaultLife Standby] Primary: ${PRIMARY_HOST}:${PRIMARY_PORT}"
echo "[VaultLife Standby] ============================================"

# ── Wait for primary to be ready ─────────────────────────────
echo "[VaultLife Standby] Waiting for primary to be ready..."
until pg_isready -h "$PRIMARY_HOST" -p "$PRIMARY_PORT" -U replicator 2>/dev/null; do
  echo "[VaultLife Standby] Primary not ready yet, retrying in 5s..."
  sleep 5
done
echo "[VaultLife Standby] ✅ Primary is ready"

# ── Check if standby already initialized ─────────────────────
if [ -f "$PGDATA/PG_VERSION" ]; then
  echo "[VaultLife Standby] Data directory already exists — skipping base backup"
  echo "[VaultLife Standby] Resuming streaming replication..."
  exit 0
fi

# ── Take base backup from primary ────────────────────────────
echo "[VaultLife Standby] Taking base backup from primary (this may take a few minutes)..."

export PGPASSWORD="$REPLICATOR_PASSWORD"

pg_basebackup \
  --host="$PRIMARY_HOST" \
  --port="$PRIMARY_PORT" \
  --username="replicator" \
  --pgdata="$PGDATA" \
  --wal-method=stream \
  --slot=standby_slot_1 \
  --checkpoint=fast \
  --progress \
  --verbose \
  --label="vaultlife_standby_$(date +%Y%m%d_%H%M%S)"

echo "[VaultLife Standby] ✅ Base backup complete"

# ── Create standby.signal ─────────────────────────────────────
# This file tells PostgreSQL to start in standby mode
touch "$PGDATA/standby.signal"
echo "[VaultLife Standby] Created standby.signal"

# ── Write primary_conninfo in postgresql.auto.conf ───────────
cat >> "$PGDATA/postgresql.auto.conf" << EOF

# ── Streaming replication connection to primary ───────────────
primary_conninfo = 'host=${PRIMARY_HOST} port=${PRIMARY_PORT} user=replicator password=${REPLICATOR_PASSWORD} application_name=vaultlife_standby sslmode=prefer connect_timeout=10'
primary_slot_name = 'standby_slot_1'
recovery_target_timeline = 'latest'
EOF

echo "[VaultLife Standby] ✅ Replication connection configured"
echo "[VaultLife Standby] ✅ Standby ready — streaming replication will start on PostgreSQL startup"

# ── Apply standby-specific config ────────────────────────────
if [ -f /etc/postgresql/standby.conf ]; then
  cp /etc/postgresql/standby.conf "$PGDATA/postgresql.conf"
  echo "[VaultLife Standby] Applied standby postgresql.conf"
fi

chown -R postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"

echo "[VaultLife Standby] ============================================"
echo "[VaultLife Standby] Initialization complete."
echo "[VaultLife Standby] Region:  ${STANDBY_REGION:-Region 2 (Night timezone)}"
echo "[VaultLife Standby] Mode:    Hot Standby (read-only queries allowed)"
echo "[VaultLife Standby] ============================================"
