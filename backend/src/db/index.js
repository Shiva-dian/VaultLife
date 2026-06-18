const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'vaultlife_db',
  user:     process.env.DB_USER     || 'vaultlife_user',
  password: process.env.DB_PASSWORD || 'vaultlife_secret_2025',
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max:      20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  // Connection acquired
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

const testConnection = async () => {
  try {
    const res = await pool.query('SELECT NOW() as now, current_database() as db');
    console.log(`[DB] ✅ Connected to PostgreSQL: ${res.rows[0].db} at ${res.rows[0].now}`);
    return true;
  } catch (err) {
    console.error('[DB] ❌ Connection failed:', err.message);
    return false;
  }
};

module.exports = { query, getClient, testConnection, pool };
