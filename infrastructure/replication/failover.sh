#!/bin/bash
# ============================================================
# failover.sh — Emergency failover: promote standby to primary
# Run on STANDBY server when primary is unreachable
#
# Usage:
#   ./failover.sh              — interactive with confirmation
#   ./failover.sh --force      — skip confirmation (automation)
#   ./failover.sh --dry-run    — simulate without promoting
# ============================================================
set -e

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
DB_USER="${POSTGRES_USER:-vaultlife_user}"
DB_NAME="${POSTGRES_DB:-vaultlife_db}"
LOG="/var/log/failover.log"
FORCE=false
DRY_RUN=false

# ── Parse args ────────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --force)   FORCE=true ;;
    --dry-run) DRY_RUN=true ;;
  esac
done

timestamp() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(timestamp)] $1" | tee -a "$LOG"; }

log "=============================================="
log "VaultLife — Failover Script Started"
log "=============================================="
log "PGDATA:   $PGDATA"
log "DRY_RUN:  $DRY_RUN"
log "FORCE:    $FORCE"

# ── Step 1: Verify standby is in recovery mode ────────────────
log "Step 1: Verifying standby is in recovery mode..."
IS_RECOVERING=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c \
  "SELECT pg_is_in_recovery();" 2>/dev/null | tr -d ' ')

if [ "$IS_RECOVERING" != "t" ]; then
  log "❌ This server is NOT in recovery mode — already a primary or not running."
  log "   pg_is_in_recovery() returned: '$IS_RECOVERING'"
  exit 1
fi
log "✅ Confirmed: server is a standby in recovery mode"

# ── Step 2: Check current replication lag ────────────────────
log "Step 2: Checking replication lag before promotion..."
LAG=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c \
  "SELECT COALESCE(EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::INTEGER, -1);" \
  2>/dev/null | tr -d ' ')
log "Current replication lag: ${LAG}s"

if [ "$LAG" -gt 60 ] && [ "$FORCE" = false ]; then
  log "⚠️  WARNING: Replication lag is ${LAG}s."
  log "   This means up to ${LAG}s of recent transactions may NOT be on this standby."
  log "   Use --force to promote anyway."
  exit 1
fi

# ── Step 3: Confirm ───────────────────────────────────────────
if [ "$FORCE" = false ] && [ "$DRY_RUN" = false ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ⚠️  FAILOVER CONFIRMATION REQUIRED"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  This will PROMOTE this standby to PRIMARY."
  echo "  Replication lag: ${LAG}s"
  echo "  Action is IRREVERSIBLE without re-sync."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  read -p "  Type 'PROMOTE' to confirm: " CONFIRM
  if [ "$CONFIRM" != "PROMOTE" ]; then
    log "Failover cancelled by user."
    exit 0
  fi
fi

if [ "$DRY_RUN" = true ]; then
  log "🔵 DRY RUN — would promote standby to primary (no action taken)"
  exit 0
fi

# ── Step 4: Promote standby → primary ────────────────────────
log "Step 4: Promoting standby to primary..."
pg_ctl promote -D "$PGDATA"

# Wait for promotion to complete
sleep 3

# ── Step 5: Verify promotion ──────────────────────────────────
log "Step 5: Verifying promotion..."
IS_RECOVERING=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c \
  "SELECT pg_is_in_recovery();" 2>/dev/null | tr -d ' ')

if [ "$IS_RECOVERING" = "f" ]; then
  log "✅ PROMOTION SUCCESSFUL — this server is now PRIMARY"
else
  log "❌ Promotion may have failed — pg_is_in_recovery() = '$IS_RECOVERING'"
  exit 1
fi

# ── Step 6: Remove standby.signal ────────────────────────────
if [ -f "$PGDATA/standby.signal" ]; then
  rm "$PGDATA/standby.signal"
  log "Removed standby.signal"
fi

# ── Step 7: Update postgresql.auto.conf ──────────────────────
log "Step 7: Clearing primary_conninfo from postgresql.auto.conf..."
grep -v "primary_conninfo\|primary_slot_name\|recovery_target" \
  "$PGDATA/postgresql.auto.conf" > /tmp/pg_auto.tmp || true
mv /tmp/pg_auto.tmp "$PGDATA/postgresql.auto.conf"

# ── Step 8: Print post-failover checklist ────────────────────
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "  ✅ FAILOVER COMPLETE"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "  POST-FAILOVER CHECKLIST:"
log "  1. Update DNS / load balancer to point to this server"
log "  2. Update VaultLife backend .env DB_HOST to this IP"
log "  3. Restart VaultLife backend: npm run dev / pm2 restart"
log "  4. Notify team — old primary must NOT restart as primary"
log "  5. When old primary recovers, re-join as NEW STANDBY:"
log "     - Run init-standby.sh pointing to this new primary"
log "  6. Verify application is writing to this new primary"
log "  7. Check replication slot: SELECT * FROM pg_replication_slots;"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Failover log saved to: $LOG"
