const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all categories
router.get('/', async (req, res, next) => {
  try {
    const type = req.query.type; // 'expense' or 'income' or undefined for all
    
    let query = 'SELECT * FROM categories';
    const params = [];
    
    if (type) {
      query += ' WHERE type = $1';
      params.push(type);
    }
    
    query += ' ORDER BY name';
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get category by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM categories WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Create new category
router.post('/', async (req, res, next) => {
  try {
    const { name, type } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ message: 'Name and type are required' });
    }
    
    if (type !== 'expense' && type !== 'income') {
      return res.status(400).json({ message: 'Type must be either "expense" or "income"' });
    }
    
    const result = await db.query(
      `INSERT INTO categories (name, type, created_at, updated_at) 
       VALUES ($1, $2, NOW(), NOW()) 
       RETURNING *`,
      [name, type]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update category
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ message: 'Name and type are required' });
    }
    
    if (type !== 'expense' && type !== 'income') {
      return res.status(400).json({ message: 'Type must be either "expense" or "income"' });
    }
    
    const result = await db.query(
      `UPDATE categories 
       SET name = $1, type = $2, updated_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [name, type, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete category
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if category has associated transactions
    const checkTransactions = await db.query(
      'SELECT COUNT(*) FROM expenses WHERE category_id = $1 UNION ALL SELECT COUNT(*) FROM incomes WHERE category_id = $1',
      [id]
    );
    
    if (parseInt(checkTransactions.rows[0].count) > 0 || parseInt(checkTransactions.rows[1].count) > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with associated transactions' 
      });
    }
    
    const result = await db.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router; 