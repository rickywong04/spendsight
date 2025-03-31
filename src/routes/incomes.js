const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all incomes
router.get('/', async (req, res) => {
  try {
    const { user_id, limit = 50 } = req.query;
    let query = `
      SELECT i.*, c.name as category_name, a.name as account_name
      FROM incomes i
      JOIN categories c ON i.category_id = c.id
      JOIN accounts a ON i.account_id = a.id
    `;
    const values = [];
    
    if (user_id) {
      query += ` WHERE i.user_id = $1`;
      values.push(user_id);
    }
    
    query += ` ORDER BY i.date DESC LIMIT $${values.length + 1}`;
    values.push(limit);
    
    const result = await db.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching incomes:', error);
    res.status(500).json({ error: 'Failed to fetch incomes' });
  }
});

// Create new income (with transaction to update account balance)
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
    
    // Create income
    const incomeResult = await client.query(
      `INSERT INTO incomes (user_id, account_id, category_id, amount, description, date) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [user_id, account_id, category_id, amount, description, date]
    );
    
    // Update account balance
    await client.query(
      `UPDATE accounts 
       SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP 
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
      income: incomeResult.rows[0],
      account: accountResult.rows[0]
    });
  } catch (error) {
    await db.rollbackTransaction(client);
    console.error('Error creating income:', error);
    res.status(500).json({ error: 'Failed to create income' });
  }
});

module.exports = router; 