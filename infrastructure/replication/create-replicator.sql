-- ============================================================
-- create-replicator.sql
-- Creates the replication user on PRIMARY
-- Run via: docker-entrypoint-initdb.d/02-replicator.sql
-- ============================================================

-- Replication-only user (minimal privileges)
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD :'REPLICATOR_PASSWORD';

-- Monitoring user for read-only health checks
CREATE USER vaultlife_monitor WITH ENCRYPTED PASSWORD :'MONITOR_PASSWORD';
GRANT pg_monitor TO vaultlife_monitor;
GRANT CONNECT ON DATABASE vaultlife_db TO vaultlife_monitor;

-- Create replication slot (ensures WAL kept until standby consumes it)
SELECT pg_create_physical_replication_slot('standby_slot_1');

\echo 'Replication user and slot created successfully'
