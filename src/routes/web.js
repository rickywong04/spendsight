const express = require('express');
const router = express.Router();
const db = require('../db');
const { models } = db;

// Home page
router.get('/', async (req, res, next) => {
  try {
    const userId = req.query.user_id || 1; // Default to user 1 for demo
    
    // Use prepared statements for complex queries (expenses with join)
    const expensesResult = await db.query(`
      SELECT e.*, c.name as category_name, a.name as account_name
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      JOIN accounts a ON e.account_id = a.id
      WHERE e.user_id = $1
      ORDER BY e.date DESC
      LIMIT 5
    `, [userId]);
    
    // Use ORM for simple queries
    const accounts = await models.Account.findAll({ user_id: userId });
    
    res.render('index', {
      title: 'Dashboard',
      expenses: expensesResult.rows,
      accounts: accounts
    });
  } catch (err) {
    next(err);
  }
});

// Expenses listing page
router.get('/expenses', async (req, res, next) => {
  try {
    // Get data for the page
    const userId = req.query.user_id || 1; // Default to user 1 for demo
    
    // Use prepared statements for complex queries (expenses with join)
    const expensesResult = await db.query(`
      SELECT e.*, c.name as category_name, a.name as account_name
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      JOIN accounts a ON e.account_id = a.id
      WHERE e.user_id = $1
      ORDER BY e.date DESC
    `, [userId]);
    
    // Use ORM for simple queries
    const accounts = await models.Account.findAll({ user_id: userId });
    const categories = await models.Category.findAll({ type: 'expense' });
    
    res.render('expenses', {
      title: 'Manage Expenses',
      expenses: expensesResult.rows,
      accounts: accounts,
      categories: categories,
      error: null,
      success: req.query.success || null
    });
  } catch (err) {
    next(err);
  }
});

// Add expense form submission
router.post('/expenses/add', async (req, res, next) => {
  try {
    const { user_id, account_id, category_id, amount, description, date } = req.body;
    
    if (!account_id || !category_id || !amount || amount <= 0) {
      // Get data for re-rendering the form with error
      const userId = user_id || 1;
      const accounts = await models.Account.findAll({ user_id: userId });
      const categories = await models.Category.findAll({ type: 'expense' });
      const expenses = await db.query(`
        SELECT e.*, c.name as category_name, a.name as account_name
        FROM expenses e
        JOIN categories c ON e.category_id = c.id
        JOIN accounts a ON e.account_id = a.id
        WHERE e.user_id = $1
        ORDER BY e.date DESC
      `, [userId]);
      
      return res.status(400).render('expenses', { 
        title: 'Manage Expenses',
        expenses: expenses.rows,
        accounts: accounts,
        categories: categories,
        error: 'Account, category, and a positive amount are required',
        success: null
      });
    }
    
    try {
      // Start a transaction
      const client = await db.getClient();
      
      try {
        await client.query('BEGIN');
        
        // Use prepared statements for the transaction
        // Create the expense
        const expenseResult = await client.query(
          `INSERT INTO expenses (user_id, account_id, category_id, amount, description, date, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
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
        client.release();
        
        res.redirect('/expenses?success=Expense added successfully');
      } catch (err) {
        await client.query('ROLLBACK');
        client.release();
        throw err;
      }
    } catch (err) {
      console.error('Transaction error:', err);
      next(err);
    }
  } catch (err) {
    next(err);
  }
});

// Edit expense form
router.get('/expenses/edit/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.query.user_id || 1; // Default to user 1 for demo
    
    // Get the expense using prepared statement (complex query with joins)
    const expenseResult = await db.query(
      `SELECT e.*, c.name as category_name, a.name as account_name
       FROM expenses e
       JOIN categories c ON e.category_id = c.id
       JOIN accounts a ON e.account_id = a.id
       WHERE e.id = $1`,
      [id]
    );
    
    if (expenseResult.rows.length === 0) {
      return res.status(404).render('error', { 
        title: 'Not Found',
        message: 'Expense not found',
        error: { status: 404 }
      });
    }
    
    // Use ORM for simple queries
    const accounts = await models.Account.findAll({ user_id: userId });
    const categories = await models.Category.findAll({ type: 'expense' });
    
    res.render('edit-expense', {
      title: 'Edit Expense',
      expense: expenseResult.rows[0],
      accounts: accounts,
      categories: categories,
      error: null
    });
  } catch (err) {
    next(err);
  }
});

// Update expense form submission
router.post('/expenses/update/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { account_id, category_id, amount, description, date } = req.body;
    
    if (!account_id || !category_id || !amount || amount <= 0) {
      // Get data for re-rendering the form with error
      const accounts = await models.Account.findAll();
      const categories = await models.Category.findAll({ type: 'expense' });
      
      return res.status(400).render('edit-expense', { 
        title: 'Edit Expense',
        expense: req.body,
        accounts: accounts,
        categories: categories,
        error: 'Account, category, and a positive amount are required'
      });
    }
    
    try {
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
          client.release();
          return res.status(404).render('error', { 
            title: 'Not Found',
            message: 'Expense not found',
            error: { status: 404 }
          });
        }
        
        const original = originalExpense.rows[0];
        const amountDiff = original.amount - amount;
        
        // Update the expense
        await client.query(
          `UPDATE expenses 
           SET account_id = $1, category_id = $2, amount = $3, description = $4, date = $5, updated_at = NOW() 
           WHERE id = $6`,
          [account_id, category_id, amount, description, date, id]
        );
        
        // If account changed, update both accounts
        if (original.account_id !== parseInt(account_id)) {
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
        client.release();
        
        res.redirect('/expenses?success=Expense updated successfully');
      } catch (err) {
        await client.query('ROLLBACK');
        client.release();
        throw err;
      }
    } catch (err) {
      console.error('Transaction error:', err);
      next(err);
    }
  } catch (err) {
    next(err);
  }
});

// Delete expense
router.post('/expenses/delete/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    try {
      // Start a transaction
      const client = await db.getClient();
      
      try {
        await client.query('BEGIN');
        
        // Get the expense details first
        const expenseResult = await client.query(
          'SELECT * FROM expenses WHERE id = $1',
          [id]
        );
        
        if (expenseResult.rows.length === 0) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(404).json({ success: false, message: 'Expense not found' });
        }
        
        const expense = expenseResult.rows[0];
        
        // Update the account balance
        await client.query(
          `UPDATE accounts 
           SET balance = balance + $1, updated_at = NOW() 
           WHERE id = $2`,
          [expense.amount, expense.account_id]
        );
        
        // Delete the expense
        await client.query(
          'DELETE FROM expenses WHERE id = $1',
          [id]
        );
        
        await client.query('COMMIT');
        client.release();
        
        res.redirect('/expenses?success=Expense deleted successfully');
      } catch (err) {
        await client.query('ROLLBACK');
        client.release();
        throw err;
      }
    } catch (err) {
      console.error('Transaction error:', err);
      next(err);
    }
  } catch (err) {
    next(err);
  }
});

// Transfer funds between accounts - using stored procedure
router.post('/accounts/transfer', async (req, res, next) => {
  try {
    const { from_account_id, to_account_id, amount } = req.body;
    
    if (!from_account_id || !to_account_id || !amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'From account, to account, and a positive amount are required'
      });
    }
    
    // Use the stored procedure
    await db.callProcedure('transfer_funds', [from_account_id, to_account_id, amount]);
    
    res.redirect('/?success=Funds transferred successfully');
  } catch (err) {
    if (err.message.includes('Insufficient funds')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient funds in source account'
      });
    }
    next(err);
  }
});

// Get expenses by category for reporting (using database function)
router.get('/reports/expenses-by-category', async (req, res, next) => {
  try {
    const { user_id, start_date, end_date } = req.query;
    
    if (!user_id || !start_date || !end_date) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID, start date, and end date are required'
      });
    }
    
    const result = await db.query(
      'SELECT * FROM get_expenses_by_category($1, $2, $3)',
      [user_id, start_date, end_date]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// Categories management page (using ORM)
router.get('/categories', async (req, res, next) => {
  try {
    // Use ORM to get all categories
    const categories = await models.Category.findAll();
    
    res.render('categories', {
      title: 'Manage Categories',
      categories: categories,
      error: null,
      success: req.query.success || null
    });
  } catch (err) {
    next(err);
  }
});

// Add category (using ORM)
router.post('/categories/add', async (req, res, next) => {
  try {
    const { name, type } = req.body;
    
    if (!name || !type) {
      const categories = await models.Category.findAll();
      return res.status(400).render('categories', { 
        title: 'Manage Categories',
        categories: categories,
        error: 'Name and type are required',
        success: null
      });
    }
    
    // Use ORM to create a new category
    await models.Category.create({ name, type });
    
    res.redirect('/categories?success=Category added successfully');
  } catch (err) {
    next(err);
  }
});

// Delete category (using ORM)
router.post('/categories/delete/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Use ORM to delete the category
    await models.Category.delete(id);
    
    res.redirect('/categories?success=Category deleted successfully');
  } catch (err) {
    next(err);
  }
});

module.exports = router; 