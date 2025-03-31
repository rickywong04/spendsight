const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all expenses
router.get('/', async (req, res) => {
  try {
    const { user_id, start_date, end_date, category_id, limit = 50 } = req.query;
    let query = `
      SELECT e.*, c.name as category_name, a.name as account_name
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      JOIN accounts a ON e.account_id = a.id
      WHERE 1=1
    `;
    const values = [];
    let valueIndex = 1;

    // Add filters if provided
    if (user_id) {
      query += ` AND e.user_id = $${valueIndex}`;
      values.push(user_id);
      valueIndex++;
    }

    if (category_id) {
      query += ` AND e.category_id = $${valueIndex}`;
      values.push(category_id);
      valueIndex++;
    }

    if (start_date) {
      query += ` AND e.date >= $${valueIndex}`;
      values.push(start_date);
      valueIndex++;
    }

    if (end_date) {
      query += ` AND e.date <= $${valueIndex}`;
      values.push(end_date);
      valueIndex++;
    }

    // Add limit and ordering
    query += ` ORDER BY e.date DESC LIMIT $${valueIndex}`;
    values.push(limit);

    const result = await db.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Get expense by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT e.*, c.name as category_name, a.name as account_name
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      JOIN accounts a ON e.account_id = a.id
      WHERE e.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// Create new expense (with transaction to update account balance)
router.post('/', async (req, res) => {
  const client = await db.beginTransaction();
  
  try {
    const { user_id, account_id, category_id, amount, description, date } = req.body;
    
    // Validate required fields
    if (!user_id || !account_id || !category_id || !amount || !date) {
      await db.rollbackTransaction(client);
      return res.status(400).json({ 
        error: 'Missing required fields: user_id, account_id, category_id, amount, date' 
      });
    }
    
    // Create expense
    const expenseResult = await client.query(
      `INSERT INTO expenses (user_id, account_id, category_id, amount, description, date) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [user_id, account_id, category_id, amount, description, date]
    );
    
    // Update account balance
    await client.query(
      `UPDATE accounts 
       SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [amount, account_id]
    );
    
    // Get updated account
    const accountResult = await client.query(
      'SELECT * FROM accounts WHERE id = $1',
      [account_id]
    );
    
    await db.commitTransaction(client);
    
    res.status(201).json({
      expense: expenseResult.rows[0],
      account: accountResult.rows[0]
    });
  } catch (error) {
    await db.rollbackTransaction(client);
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Update expense
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, description } = req.body;
    
    // Build dynamic query based on provided fields
    let query = 'UPDATE expenses SET updated_at = CURRENT_TIMESTAMP';
    const values = [];
    let paramCount = 1;
    
    if (category_id) {
      query += `, category_id = $${paramCount}`;
      values.push(category_id);
      paramCount++;
    }
    
    if (description) {
      query += `, description = $${paramCount}`;
      values.push(description);
      paramCount++;
    }
    
    query += ` WHERE id = $${paramCount} RETURNING *`;
    values.push(id);
    
    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Delete expense (with transaction to update account balance)
router.delete('/:id', async (req, res) => {
  const client = await db.beginTransaction();
  
  try {
    const { id } = req.params;
    
    // Get expense details first to know the amount and account
    const expenseResult = await client.query(
      'SELECT * FROM expenses WHERE id = $1',
      [id]
    );
    
    if (expenseResult.rows.length === 0) {
      await db.rollbackTransaction(client);
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    const expense = expenseResult.rows[0];
    
    // Delete the expense
    await client.query('DELETE FROM expenses WHERE id = $1', [id]);
    
    // Restore the account balance
    await client.query(
      `UPDATE accounts 
       SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [expense.amount, expense.account_id]
    );
    
    // Get updated account
    const accountResult = await client.query(
      'SELECT * FROM accounts WHERE id = $1',
      [expense.account_id]
    );
    
    await db.commitTransaction(client);
    
    res.json({ 
      message: 'Expense deleted successfully', 
      expense,
      account: accountResult.rows[0]
    });
  } catch (error) {
    await db.rollbackTransaction(client);
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

module.exports = router; 