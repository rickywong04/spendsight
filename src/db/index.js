const { Pool } = require('pg');
require('dotenv').config();
const format = require('pg-format');
const { promisify } = require('util');

// Create connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'spendsight',
  // Set a longer connection timeout
  connectionTimeoutMillis: 5000, 
  // Add a retry strategy
  max: 20,
  idleTimeoutMillis: 30000,
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
  }
});

/**
 * Execute a query with parameters (Prepared Statement)
 * @param {string} text - The SQL query
 * @param {Array} params - The parameters for the query
 * @returns {Promise} - A promise resolving to the query result
 */
const query = async (text, params) => {
  try {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries in development
    if (process.env.NODE_ENV === 'development' && duration > 100) {
      console.log('Slow query:', { text, duration, rows: result.rowCount });
    }
    
    return result;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

/**
 * Get a client from the pool
 * @returns {Promise} - A promise resolving to a client
 */
const getClient = async () => {
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    console.error('Error getting client from pool:', error);
    throw error;
  }
};

/**
 * Call a stored procedure
 * @param {string} procedureName - The name of the procedure
 * @param {Array} params - The parameters for the procedure
 * @returns {Promise} - A promise resolving to the procedure result
 */
const callProcedure = async (procedureName, params) => {
  const paramPlaceholders = params.map((_, i) => `$${i + 1}`).join(', ');
  const query = `CALL ${procedureName}(${paramPlaceholders})`;
  
  try {
    return await pool.query(query, params);
  } catch (error) {
    console.error(`Error calling procedure ${procedureName}:`, error);
    throw error;
  }
};

/**
 * Basic ORM functionality for database entities
 */
class BaseModel {
  constructor(tableName, fields) {
    this.tableName = tableName;
    this.fields = fields;
  }

  /**
   * Find all records in the table
   * @param {Object} where - The where clause conditions
   * @returns {Promise<Array>} - A promise resolving to an array of records
   */
  async findAll(where = {}) {
    let whereClause = '';
    const params = [];
    
    // Build the where clause
    if (Object.keys(where).length > 0) {
      const conditions = [];
      let paramIndex = 1;
      
      for (const [key, value] of Object.entries(where)) {
        conditions.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
      
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }
    
    const text = `SELECT * FROM ${this.tableName} ${whereClause}`;
    const result = await query(text, params);
    return result.rows;
  }

  /**
   * Find a record by id
   * @param {number} id - The id of the record
   * @returns {Promise<Object>} - A promise resolving to the record
   */
  async findById(id) {
    const text = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const result = await query(text, [id]);
    return result.rows[0];
  }

  /**
   * Create a new record
   * @param {Object} data - The data for the new record
   * @returns {Promise<Object>} - A promise resolving to the new record
   */
  async create(data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const fieldNames = fields.join(', ');
    
    const text = `INSERT INTO ${this.tableName} (${fieldNames}) VALUES (${placeholders}) RETURNING *`;
    const result = await query(text, values);
    return result.rows[0];
  }

  /**
   * Update a record
   * @param {number} id - The id of the record to update
   * @param {Object} data - The data to update
   * @returns {Promise<Object>} - A promise resolving to the updated record
   */
  async update(id, data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
    
    const text = `UPDATE ${this.tableName} SET ${setClause}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING *`;
    const result = await query(text, [...values, id]);
    return result.rows[0];
  }

  /**
   * Delete a record
   * @param {number} id - The id of the record to delete
   * @returns {Promise<boolean>} - A promise resolving to true if successful
   */
  async delete(id) {
    const text = `DELETE FROM ${this.tableName} WHERE id = $1`;
    await query(text, [id]);
    return true;
  }
}

// Create model instances for each entity
const User = new BaseModel('users', ['id', 'name', 'email', 'created_at', 'updated_at']);
const Account = new BaseModel('accounts', ['id', 'user_id', 'name', 'type', 'balance', 'created_at', 'updated_at']);
const Category = new BaseModel('categories', ['id', 'name', 'type', 'created_at', 'updated_at']);
const Expense = new BaseModel('expenses', ['id', 'user_id', 'account_id', 'category_id', 'amount', 'description', 'date', 'created_at', 'updated_at']);
const Income = new BaseModel('incomes', ['id', 'user_id', 'account_id', 'category_id', 'amount', 'description', 'date', 'created_at', 'updated_at']);

module.exports = {
  query,
  getClient,
  pool,
  callProcedure,
  models: {
    User,
    Account,
    Category,
    Expense,
    Income
  }
}; 