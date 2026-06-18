#!/bin/bash
# ============================================================
# init-primary.sh — PRIMARY server initialization
# Runs once on first container start via docker-entrypoint-initdb.d
# ============================================================
set -e

echo "[VaultLife Primary] Initializing primary server..."

# ── Create WAL archive directory ──────────────────────────────
mkdir -p /var/lib/postgresql/wal_archive
chown -R postgres:postgres /var/lib/postgresql/wal_archive
chmod 700 /var/lib/postgresql/wal_archive

# ── Create replication user ───────────────────────────────────
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" << EOSQL
  -- Replication-only user
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'replicator') THEN
      CREATE ROLE replicator WITH REPLICATION LOGIN ENCRYPTED PASSWORD '${REPLICATOR_PASSWORD}';
      RAISE NOTICE 'Created replicator role';
    END IF;
  END;
  \$\$;

  -- Monitoring user (read-only)
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'vaultlife_monitor') THEN
      CREATE ROLE vaultlife_monitor WITH LOGIN ENCRYPTED PASSWORD 'monitor_pass_change_me';
      GRANT pg_monitor TO vaultlife_monitor;
      GRANT CONNECT ON DATABASE vaultlife_db TO vaultlife_monitor;
      RAISE NOTICE 'Created monitor role';
    END IF;
  END;
  \$\$;

  -- Create physical replication slot (WAL kept until standby consumes)
  SELECT CASE
    WHEN NOT EXISTS (SELECT FROM pg_replication_slots WHERE slot_name = 'standby_slot_1')
    THEN pg_create_physical_replication_slot('standby_slot_1')
  END;
EOSQL

echo "[VaultLife Primary] ✅ Primary initialization complete"
echo "[VaultLife Primary] WAL archive: /var/lib/postgresql/wal_archive"
echo "[VaultLife Primary] Replication slot: standby_slot_1"
echo "[VaultLife Primary] Waiting for standby connection..."
