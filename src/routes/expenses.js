const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all expenses
router.get('/', async (req, res, next) => {
  try {
    const { user_id, account_id, category_id, start_date, end_date, limit, offset } = req.query;
    const userId = user_id || 1; // Default to user 1 for demo
    
    let query = `
      SELECT e.*, c.name as category_name, a.name as account_name
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      JOIN accounts a ON e.account_id = a.id
      WHERE e.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;
    
    if (account_id) {
      query += ` AND e.account_id = $${paramIndex}`;
      params.push(account_id);
      paramIndex++;
    }
    
    if (category_id) {
      query += ` AND e.category_id = $${paramIndex}`;
      params.push(category_id);
      paramIndex++;
    }
    
    if (start_date) {
      query += ` AND e.date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND e.date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    query += ` ORDER BY e.date DESC`;
    
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }
    
    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
    }
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get expense by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT e.*, c.name as category_name, a.name as account_name
       FROM expenses e
       JOIN categories c ON e.category_id = c.id
       JOIN accounts a ON e.account_id = a.id
       WHERE e.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Create new expense
router.post('/', async (req, res, next) => {
  try {
    const { user_id, account_id, category_id, amount, description, date } = req.body;
    
    if (!account_id || !category_id || !amount) {
      return res.status(400).json({ message: 'Account, category and amount are required' });
    }
    
    // Start a transaction
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Create the expense
      const expenseResult = await client.query(
        `INSERT INTO expenses (user_id, account_id, category_id, amount, description, date, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
         RETURNING *`,
        [user_id || 1, account_id, category_id, amount, description || '', date || new Date()]
      );
      
      // Update the account balance
      await client.query(
        `UPDATE accounts 
         SET balance = balance - $1, updated_at = NOW() 
         WHERE id = $2`,
        [amount, account_id]
      );
      
      await client.query('COMMIT');
      
      // Get the full expense data with joins
      const fullExpenseData = await db.query(
        `SELECT e.*, c.name as category_name, a.name as account_name
         FROM expenses e
         JOIN categories c ON e.category_id = c.id
         JOIN accounts a ON e.account_id = a.id
         WHERE e.id = $1`,
        [expenseResult.rows[0].id]
      );
      
      res.status(201).json(fullExpenseData.rows[0]);
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

// Update expense
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { account_id, category_id, amount, description, date } = req.body;
    
    if (!account_id || !category_id || !amount) {
      return res.status(400).json({ message: 'Account, category and amount are required' });
    }
    
    // Start a transaction
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get the original expense to calculate balance adjustment
      const originalExpense = await client.query(
        'SELECT * FROM expenses WHERE id = $1',
        [id]
      );
      
      if (originalExpense.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Expense not found' });
      }
      
      const original = originalExpense.rows[0];
      const amountDiff = original.amount - amount;
      
      // Update the expense
      const expenseResult = await client.query(
        `UPDATE expenses 
         SET account_id = $1, category_id = $2, amount = $3, description = $4, date = $5, updated_at = NOW() 
         WHERE id = $6 
         RETURNING *`,
        [account_id, category_id, amount, description, date, id]
      );
      
      // If account changed, update both accounts
      if (original.account_id !== account_id) {
        // Add the original amount back to the original account
        await client.query(
          `UPDATE accounts 
           SET balance = balance + $1, updated_at = NOW() 
           WHERE id = $2`,
          [original.amount, original.account_id]
        );
        
        // Subtract the new amount from the new account
        await client.query(
          `UPDATE accounts 
           SET balance = balance - $1, updated_at = NOW() 
           WHERE id = $2`,
          [amount, account_id]
        );
      } else {
        // Update the same account with the difference
        await client.query(
          `UPDATE accounts 
           SET balance = balance + $1, updated_at = NOW() 
           WHERE id = $2`,
          [amountDiff, account_id]
        );
      }
      
      await client.query('COMMIT');
      
      // Get the full expense data with joins
      const fullExpenseData = await db.query(
        `SELECT e.*, c.name as category_name, a.name as account_name
         FROM expenses e
         JOIN categories c ON e.category_id = c.id
         JOIN accounts a ON e.account_id = a.id
         WHERE e.id = $1`,
        [id]
      );
      
      res.json(fullExpenseData.rows[0]);
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

// Delete expense
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Start a transaction
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get the expense to update the account balance
      const expenseResult = await client.query(
        'SELECT * FROM expenses WHERE id = $1',
        [id]
      );
      
      if (expenseResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Expense not found' });
      }
      
      const expense = expenseResult.rows[0];
      
      // Delete the expense
      await client.query('DELETE FROM expenses WHERE id = $1', [id]);
      
      // Update the account balance
      await client.query(
        `UPDATE accounts 
         SET balance = balance + $1, updated_at = NOW() 
         WHERE id = $2`,
        [expense.amount, expense.account_id]
      );
      
      await client.query('COMMIT');
      
      res.json({ message: 'Expense deleted successfully' });
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