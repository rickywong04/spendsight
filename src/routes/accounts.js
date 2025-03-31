const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all accounts
router.get('/', async (req, res, next) => {
  try {
    const userId = req.query.user_id || 1; // Default to user 1 for demo
    const result = await db.query(
      'SELECT * FROM accounts WHERE user_id = $1 ORDER BY name',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get account by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM accounts WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Create new account
router.post('/', async (req, res, next) => {
  try {
    const { user_id, name, type, balance } = req.body;
    
    const result = await db.query(
      `INSERT INTO accounts (user_id, name, type, balance, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, NOW(), NOW()) 
       RETURNING *`,
      [user_id || 1, name, type, balance || 0]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update account
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type, balance } = req.body;
    
    const result = await db.query(
      `UPDATE accounts 
       SET name = $1, type = $2, balance = $3, updated_at = NOW() 
       WHERE id = $4 
       RETURNING *`,
      [name, type, balance, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete account
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if account has associated transactions
    const checkTransactions = await db.query(
      'SELECT COUNT(*) FROM expenses WHERE account_id = $1 UNION ALL SELECT COUNT(*) FROM incomes WHERE account_id = $1',
      [id]
    );
    
    if (parseInt(checkTransactions.rows[0].count) > 0 || parseInt(checkTransactions.rows[1].count) > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete account with associated transactions' 
      });
    }
    
    const result = await db.query('DELETE FROM accounts WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// Transfer funds between accounts
router.post('/transfer', async (req, res, next) => {
  try {
    const { from_account_id, to_account_id, amount } = req.body;
    
    if (!from_account_id || !to_account_id || !amount || amount <= 0) {
      return res.status(400).json({ 
        message: 'Invalid transfer parameters'
      });
    }
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Call the stored procedure we created in init.sql
      const result = await client.query(
        'CALL transfer_funds($1, $2, $3, $4)',
        [from_account_id, to_account_id, amount, 'Transfer']
      );
      
      await client.query('COMMIT');
      
      // Fetch the updated accounts
      const accounts = await db.query(
        'SELECT * FROM accounts WHERE id IN ($1, $2)',
        [from_account_id, to_account_id]
      );
      
      res.json({
        message: 'Transfer completed successfully',
        accounts: accounts.rows
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router; 