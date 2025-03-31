const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

/**
 * Initialize the database with tables and sample data
 */
async function initializeDatabase() {
  try {
    console.log('Beginning database initialization...');
    
    // Read SQL file
    const sqlFilePath = path.join(__dirname, 'init.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute SQL
    await pool.query(sql);
    
    console.log('Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

// Run initialization
initializeDatabase(); 