const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Database connected at:', res.rows[0].now);
  }
});

/**
 * Execute a query with parameters
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise} - Query result
 */
const query = (text, params) => pool.query(text, params);

/**
 * Begin a transaction
 * @returns {Promise<any>} - Database client with active transaction
 */
const beginTransaction = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    return client;
  } catch (e) {
    client.release();
    throw e;
  }
};

/**
 * Commit a transaction
 * @param {any} client - Database client with active transaction
 */
const commitTransaction = async (client) => {
  try {
    await client.query('COMMIT');
  } finally {
    client.release();
  }
};

/**
 * Rollback a transaction
 * @param {any} client - Database client with active transaction
 */
const rollbackTransaction = async (client) => {
  try {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
};

module.exports = {
  query,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  pool
}; 