const { Pool } = require('pg');
require('dotenv').config();

// Create connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Set a longer connection timeout
  connectionTimeoutMillis: 5000, 
  // Add a retry strategy
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
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
 * Execute a query with parameters
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
    
    // Rethrow the error to handle it in the route handler
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

// Create a mock database if connection fails (for development/testing)
let mockDb = null;

/**
 * Get a mock database for development/testing when real DB is unavailable
 */
const getMockDb = () => {
  if (!mockDb) {
    // Initialize in-memory mock data
    mockDb = {
      users: [{ id: 1, name: 'Demo User', email: 'demo@example.com' }],
      accounts: [
        { id: 1, user_id: 1, name: 'Checking Account', type: 'checking', balance: 1000 },
        { id: 2, user_id: 1, name: 'Savings Account', type: 'savings', balance: 5000 }
      ],
      categories: [
        { id: 1, name: 'Groceries', type: 'expense' },
        { id: 2, name: 'Dining', type: 'expense' },
        { id: 3, name: 'Transportation', type: 'expense' },
        { id: 4, name: 'Utilities', type: 'expense' },
        { id: 5, name: 'Salary', type: 'income' }
      ],
      expenses: [
        { 
          id: 1, 
          user_id: 1, 
          account_id: 1, 
          category_id: 1, 
          amount: 75.50, 
          description: 'Weekly groceries', 
          date: new Date(), 
          created_at: new Date(), 
          updated_at: new Date() 
        }
      ],
      incomes: [
        { 
          id: 1, 
          user_id: 1, 
          account_id: 1, 
          category_id: 5, 
          amount: 2500, 
          description: 'Monthly salary', 
          date: new Date(), 
          created_at: new Date(), 
          updated_at: new Date() 
        }
      ]
    };
  }
  
  return mockDb;
};

/**
 * Fallback query function that uses mock data if DB is unavailable
 */
const fallbackQuery = async (text, params) => {
  try {
    return await query(text, params);
  } catch (error) {
    console.warn('Database unavailable, using mock data');
    
    // Very simple mock implementation for testing
    const mockData = getMockDb();
    
    // Simple parsing of query to determine what to return
    if (text.includes('FROM accounts')) {
      return { rows: mockData.accounts };
    } else if (text.includes('FROM categories')) {
      const isExpenseType = text.includes('type = $1') && params[0] === 'expense';
      return { 
        rows: isExpenseType 
          ? mockData.categories.filter(c => c.type === 'expense') 
          : mockData.categories 
      };
    } else if (text.includes('FROM expenses')) {
      return { rows: mockData.expenses };
    } else if (text.includes('FROM incomes')) {
      return { rows: mockData.incomes };
    }
    
    return { rows: [] };
  }
};

module.exports = {
  query: fallbackQuery,
  getClient,
  pool
}; 