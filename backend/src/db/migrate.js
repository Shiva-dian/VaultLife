const fs   = require('fs');
const path = require('path');
const { pool, testConnection } = require('./index');
require('dotenv').config();

async function runMigrations(reset = false) {
  const connected = await testConnection();
  if (!connected) {
    console.error('[Migrate] Cannot connect to DB. Is Docker running?');
    console.error('[Migrate] Run: docker-compose up -d postgres');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    if (reset) {
      console.log('[Migrate] ⚠️  Resetting database...');
      await client.query(`
        DROP TABLE IF EXISTS audit_log, refresh_tokens, otp_tokens, subscription_plans, users CASCADE;
        DROP TYPE  IF EXISTS user_status, otp_channel, otp_purpose, audit_action CASCADE;
        DROP FUNCTION IF EXISTS trigger_set_updated_at CASCADE;
        DROP FUNCTION IF EXISTS cleanup_expired_otps CASCADE;
        DROP VIEW  IF EXISTS user_summary CASCADE;
      `);
      console.log('[Migrate] ✅ Database reset complete');
    }

    const sqlPath = path.join(__dirname, '../../migrations/init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('[Migrate] Running init.sql...');
    await client.query(sql);
    console.log('[Migrate] ✅ Migrations applied successfully');

    // Verify tables
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name;
    `);
    console.log('[Migrate] Tables:', result.rows.map(r => r.table_name).join(', '));
  } catch (err) {
    console.error('[Migrate] ❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

const reset = process.argv.includes('--reset');
runMigrations(reset);
