const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all accounts
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM accounts ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Get account by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM accounts WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// Create new account
router.post('/', async (req, res) => {
  try {
    const { user_id, name, type, balance = 0 } = req.body;
    
    // Validate required fields
    if (!user_id || !name || !type) {
      return res.status(400).json({ error: 'Missing required fields: user_id, name, type' });
    }
    
    const result = await db.query(
      'INSERT INTO accounts (user_id, name, type, balance) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, name, type, balance]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Update account
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, balance } = req.body;
    
    // Build dynamic query based on provided fields
    let query = 'UPDATE accounts SET updated_at = CURRENT_TIMESTAMP';
    const values = [];
    let paramCount = 1;
    
    if (name) {
      query += `, name = $${paramCount}`;
      values.push(name);
      paramCount++;
    }
    
    if (type) {
      query += `, type = $${paramCount}`;
      values.push(type);
      paramCount++;
    }
    
    if (balance !== undefined) {
      query += `, balance = $${paramCount}`;
      values.push(balance);
      paramCount++;
    }
    
    query += ` WHERE id = $${paramCount} RETURNING *`;
    values.push(id);
    
    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// Delete account
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM accounts WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json({ message: 'Account deleted successfully', account: result.rows[0] });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Transfer funds between accounts (uses stored procedure)
router.post('/transfer', async (req, res) => {
  const client = await db.beginTransaction();
  
  try {
    const { from_account_id, to_account_id, amount } = req.body;
    
    // Validate required fields
    if (!from_account_id || !to_account_id || !amount) {
      await db.rollbackTransaction(client);
      return res.status(400).json({ 
        error: 'Missing required fields: from_account_id, to_account_id, amount' 
      });
    }
    
    // Call the stored procedure
    await client.query(
      'CALL transfer_funds($1, $2, $3)',
      [from_account_id, to_account_id, amount]
    );
    
    // Get updated accounts
    const fromAccount = await client.query(
      'SELECT * FROM accounts WHERE id = $1',
      [from_account_id]
    );
    
    const toAccount = await client.query(
      'SELECT * FROM accounts WHERE id = $1',
      [to_account_id]
    );
    
    await db.commitTransaction(client);
    
    res.status(200).json({
      message: 'Funds transferred successfully',
      from_account: fromAccount.rows[0],
      to_account: toAccount.rows[0],
      amount
    });
  } catch (error) {
    await db.rollbackTransaction(client);
    console.error('Error transferring funds:', error);
    res.status(500).json({ error: error.message || 'Failed to transfer funds' });
  }
});

module.exports = router; 