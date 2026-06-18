# VaultLife — PostgreSQL Streaming Replication Setup Guide

## Architecture: Follow-the-Sun

```
┌─────────────────────────────────────────────────────────────┐
│  REGION 1 — DAY (Primary)         REGION 2 — NIGHT (Standby)│
│                                                              │
│  Mumbai / Chennai                 São Paulo / US Central     │
│  UTC+5:30                         UTC-3 / UTC-6              │
│  Business hours: active writes    Off-peak: backup + sync    │
│                                                              │
│  vaultlife_primary ──WAL stream──▶ vaultlife_standby         │
│  Port 5432                         Port 5432 (read-only)     │
│  Reads + Writes                    Reads only + Daily backup │
└─────────────────────────────────────────────────────────────┘
```

**Why opposite timezones?**
- When Region 1 is at peak load (09:00–18:00), Region 2 is sleeping (off-peak)
- Daily backups run at 02:00 AM Region 2 time — zero impact on production
- If Region 1 fails during business hours, Region 2 promotes in < 1 minute

---

## Recommended Region Pairs

| Primary (Day)         | Standby (Night)        | Offset  |
|-----------------------|------------------------|---------|
| Mumbai (UTC+5:30)     | São Paulo (UTC-3)      | 8.5h    |
| Mumbai (UTC+5:30)     | US Central (UTC-6)     | 11.5h   |
| Singapore (UTC+8)     | London (UTC+0)         | 8h      |
| Tokyo (UTC+9)         | Frankfurt (UTC+1)      | 8h      |
| US East (UTC-5)       | Mumbai (UTC+5:30)      | 10.5h   |
| Frankfurt (UTC+1)     | US West (UTC-8)        | 9h      |
| Sydney (UTC+11)       | London (UTC+0)         | 11h     |

---

## Prerequisites

- Two servers / VMs in different regions
- PostgreSQL 15 installed on both
- Docker + Docker Compose on both
- Network: standby can reach primary on port 5432
- Firewall: open port 5432 between the two servers

---

## Step 1 — Prepare Both Servers

```bash
# On BOTH servers — install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Clone repo
git clone https://github.com/yourorg/vaultlife.git
cd vaultlife/infrastructure/replication

# Copy and edit environment file
cp .env.example .env
nano .env  # Fill in passwords and PRIMARY_HOST
```

---

## Step 2 — Configure Primary (Region 1)

```bash
# On PRIMARY server (Mumbai / Region 1)

# 1. Set firewall — allow standby IP on port 5432
sudo ufw allow from STANDBY_SERVER_IP to any port 5432

# 2. Edit pg_hba.conf — replace STANDBY_SERVER_IP
sed -i 's/STANDBY_SERVER_IP/YOUR_ACTUAL_STANDBY_IP/' primary-pg_hba.conf

# 3. Start primary
docker-compose -f docker-compose.replication.yml up -d primary

# 4. Verify primary is running
docker logs vaultlife_primary --tail=20

# 5. Check replication slot was created
docker exec vaultlife_primary psql -U vaultlife_user -d vaultlife_db \
  -c "SELECT slot_name, slot_type, active FROM pg_replication_slots;"
```

Expected output:
```
    slot_name    | slot_type | active
-----------------+-----------+--------
 standby_slot_1  | physical  | f      ← 'f' until standby connects
```

---

## Step 3 — Initialize Standby (Region 2)

```bash
# On STANDBY server (São Paulo / Region 2)

# 1. Set PRIMARY_HOST in .env
echo "PRIMARY_HOST=13.235.xx.xx" >> .env  # Your primary's IP

# 2. Edit pg_hba.conf — replace PRIMARY_SERVER_IP
sed -i 's/PRIMARY_SERVER_IP/YOUR_ACTUAL_PRIMARY_IP/' standby-pg_hba.conf

# 3. Make scripts executable
chmod +x init-standby.sh backup-cron.sh failover.sh monitor.sh

# 4. Start standby (will run pg_basebackup automatically)
docker-compose -f docker-compose.replication.yml up -d standby

# 5. Watch initialization logs
docker logs vaultlife_standby -f

# You should see:
# [VaultLife Standby] Taking base backup from primary...
# [VaultLife Standby] ✅ Base backup complete
# [VaultLife Standby] ✅ Standby ready
```

---

## Step 4 — Verify Replication is Working

```bash
# On PRIMARY — check standby connected
docker exec vaultlife_primary psql -U vaultlife_user -d vaultlife_db \
  -c "SELECT client_addr, application_name, state, sync_state,
             replay_lag, sent_lsn, replay_lsn
      FROM pg_stat_replication;"

# Expected:
#  client_addr | application_name    | state     | sync_state | replay_lag
# -------------+---------------------+-----------+------------+------------
#  10.x.x.x    | vaultlife_standby   | streaming | async      | 00:00:00.01

# On STANDBY — check it's in recovery mode
docker exec vaultlife_standby psql -U vaultlife_user -d vaultlife_db \
  -c "SELECT pg_is_in_recovery(), pg_last_xact_replay_timestamp();"

# Expected:
#  pg_is_in_recovery | pg_last_xact_replay_timestamp
# -------------------+-------------------------------
#  t                 | 2025-01-15 14:23:45.123+05:30

# Test replication — write on primary, read on standby
docker exec vaultlife_primary psql -U vaultlife_user -d vaultlife_db \
  -c "CREATE TABLE IF NOT EXISTS repl_test (id SERIAL, ts TIMESTAMPTZ DEFAULT NOW()); INSERT INTO repl_test DEFAULT VALUES;"

# Wait 2 seconds, then check standby
sleep 2
docker exec vaultlife_standby psql -U vaultlife_user -d vaultlife_db \
  -c "SELECT * FROM repl_test ORDER BY id DESC LIMIT 1;"
```

---

## Step 5 — Start Backup and Monitor Services

```bash
# On STANDBY server
docker-compose -f docker-compose.replication.yml up -d pgbackup repl_monitor

# Verify backup service
docker logs vaultlife_backup --tail=20

# Manually trigger a test backup
docker exec vaultlife_backup /usr/local/bin/backup-cron.sh

# Check backup was created
docker exec vaultlife_backup ls -lh /backups/

# Check replication monitor
docker logs vaultlife_repl_monitor --tail=20
```

---

## Step 6 — Verify Daily Backup Schedule

Backups run at **02:00 AM standby local time** (night = off-peak):

```
Daily:   /backups/vaultlife_backup_YYYYMMDD_HHMMSS.sql.gz  (kept 30 days)
Weekly:  /backups/weekly/vaultlife_weekly_YYYY-MM-DD.sql.gz (kept 12 weeks)
Monthly: /backups/monthly/vaultlife_monthly_YYYY-MM.sql.gz  (kept 12 months)
Latest:  /backups/latest.sql.gz (symlink to most recent)
```

**Backup manifest** (JSON summary):
```bash
docker exec vaultlife_backup cat /backups/backup_manifest.json
```

---

## Monitoring Replication Lag

```bash
# Real-time lag check
docker exec vaultlife_standby psql -U vaultlife_user -d vaultlife_db -c \
  "SELECT
     now() - pg_last_xact_replay_timestamp() AS replication_lag,
     pg_is_in_recovery() AS is_standby;"

# Check replication monitor JSON status
docker exec vaultlife_repl_monitor cat /tmp/repl_status.json

# Check replication monitor log
docker exec vaultlife_repl_monitor tail -50 /var/log/replication_monitor.log
```

**Acceptable lag thresholds:**
- `< 10s`  — Excellent (green)
- `10–60s` — Normal for cross-region (green)
- `60–300s`— Warning — check network (yellow)
- `> 300s` — Critical — investigate immediately (red)

---

## Emergency Failover (if Primary fails)

```bash
# On STANDBY server — promote to primary

# Option 1: Interactive (asks for confirmation)
./failover.sh

# Option 2: Force (automated systems)
./failover.sh --force

# Option 3: Dry run (test without promoting)
./failover.sh --dry-run

# After failover — update VaultLife backend
# Edit backend/.env:
# DB_HOST=STANDBY_SERVER_IP  (now the new primary)
# Then restart backend:
pm2 restart vaultlife-backend
# or:
docker-compose restart backend
```

---

## Restore from Backup

```bash
# List available backups
docker exec vaultlife_backup ls -lht /backups/ | head -20

# Restore from latest backup to a NEW database
docker exec vaultlife_backup pg_restore \
  --host=localhost \
  --username=vaultlife_user \
  --dbname=vaultlife_db_restored \
  --verbose \
  /backups/latest.sql.gz

# Restore specific backup
docker exec vaultlife_backup pg_restore \
  --host=localhost \
  --username=vaultlife_user \
  --dbname=vaultlife_db \
  /backups/vaultlife_backup_20250115_020000.sql.gz
```

---

## Re-join Old Primary as New Standby

After failover, once the old primary server is recovered:

```bash
# On the OLD primary (now being re-initialized as standby)

# 1. Stop PostgreSQL
docker-compose -f docker-compose.replication.yml stop primary

# 2. Clear old data directory
rm -rf /var/lib/postgresql/data/*

# 3. Update .env — set PRIMARY_HOST to new primary (old standby IP)
echo "PRIMARY_HOST=NEW_PRIMARY_IP" >> .env

# 4. Run standby initialization (pg_basebackup from new primary)
./init-standby.sh

# 5. Start as standby
docker-compose -f docker-compose.replication.yml up -d standby
```

---

## VaultLife Backend — Multi-region Connection

Update `backend/.env` for read/write splitting:

```env
# Primary (writes)
DB_HOST=PRIMARY_SERVER_IP
DB_PORT=5432
DB_NAME=vaultlife_db
DB_USER=vaultlife_user
DB_PASSWORD=your_password

# Standby (reads — optional, for analytics/reports)
DB_READ_HOST=STANDBY_SERVER_IP
DB_READ_PORT=5432
```

---

## Security Checklist

- [ ] Change all default passwords in `.env`
- [ ] Enable SSL on both primary and standby (`ssl = on` in postgresql.conf)
- [ ] Restrict `pg_hba.conf` to specific IPs only
- [ ] Use VPN or private network between regions (not public internet)
- [ ] Enable firewall — only allow port 5432 from known IPs
- [ ] Never commit `.env` to git (it's in `.gitignore`)
- [ ] Rotate replication user password quarterly
- [ ] Monitor backup manifest daily for `"status": "success"`

---

## File Reference

```
infrastructure/replication/
├── docker-compose.replication.yml  ← Main compose file
├── primary-postgresql.conf         ← Primary PostgreSQL settings
├── primary-pg_hba.conf             ← Primary access control
├── standby-postgresql.conf         ← Standby PostgreSQL settings
├── standby-pg_hba.conf             ← Standby access control
├── create-replicator.sql           ← Creates replication user
├── init-primary.sh                 ← Primary initialization
├── init-standby.sh                 ← Standby bootstrap (pg_basebackup)
├── backup-cron.sh                  ← Daily backup script
├── monitor.sh                      ← Replication lag monitor
├── failover.sh                     ← Emergency failover script
├── region-pairs.js                 ← Timezone-opposite region reference
├── .env.example                    ← Environment template
└── README.md                       ← This file
```
