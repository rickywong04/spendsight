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

// Accounts listing page
router.get('/accounts', async (req, res, next) => {
  try {
    const userId = req.query.user_id || 1; // Default to user 1 for demo
    
    // Get all accounts for this user using ORM
    const accounts = await models.Account.findAll({ user_id: userId });
    
    // Get account balance statistics
    const accountStats = await db.query(`
      SELECT 
        a.id,
        COALESCE(SUM(e.amount), 0) AS total_expenses,
        COALESCE(COUNT(e.id), 0) AS expense_count
      FROM 
        accounts a
      LEFT JOIN 
        expenses e ON a.id = e.account_id
      WHERE 
        a.user_id = $1
      GROUP BY 
        a.id
    `, [userId]);
    
    // Combine account data with stats
    const accountsWithStats = accounts.map(account => {
      const stats = accountStats.rows.find(stat => stat.id === account.id) || { total_expenses: 0, expense_count: 0 };
      return {
        ...account,
        total_expenses: stats.total_expenses,
        expense_count: stats.expense_count
      };
    });
    
    res.render('accounts', {
      title: 'Manage Accounts',
      accounts: accountsWithStats,
      error: null,
      success: req.query.success || null
    });
  } catch (err) {
    next(err);
  }
});

// Add account form submission
router.post('/accounts/add', async (req, res, next) => {
  try {
    const { user_id, name, type, balance } = req.body;
    
    if (!name || !type) {
      const userId = user_id || 1;
      const accounts = await models.Account.findAll({ user_id: userId });
      
      return res.status(400).render('accounts', { 
        title: 'Manage Accounts',
        accounts: accounts,
        error: 'Account name and type are required',
        success: null
      });
    }
    
    const initialBalance = balance ? parseFloat(balance) : 0;
    
    // Create new account using ORM
    await models.Account.create({
      user_id: user_id || 1,
      name,
      type,
      balance: initialBalance
    });
    
    res.redirect('/accounts?success=Account added successfully');
  } catch (err) {
    next(err);
  }
});

// Edit account form
router.get('/accounts/edit/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get the account using ORM
    const account = await models.Account.findById(id);
    
    if (!account) {
      return res.status(404).render('error', { 
        title: 'Not Found',
        message: 'Account not found',
        error: { status: 404 }
      });
    }
    
    res.render('edit-account', {
      title: 'Edit Account',
      account: account,
      error: null
    });
  } catch (err) {
    next(err);
  }
});

// Update account form submission
router.post('/accounts/update/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type, balance } = req.body;
    
    if (!name || !type) {
      const account = await models.Account.findById(id);
      
      return res.status(400).render('edit-account', { 
        title: 'Edit Account',
        account: {...account, ...req.body},
        error: 'Account name and type are required'
      });
    }
    
    // Update account using ORM
    await models.Account.update(id, {
      name,
      type,
      balance: parseFloat(balance) || 0
    });
    
    res.redirect('/accounts?success=Account updated successfully');
  } catch (err) {
    next(err);
  }
});

// Delete account
router.post('/accounts/delete/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if account has associated transactions
    const checkTransactions = await db.query(
      'SELECT COUNT(*) FROM expenses WHERE account_id = $1 UNION ALL SELECT COUNT(*) FROM incomes WHERE account_id = $1',
      [id]
    );
    
    if (parseInt(checkTransactions.rows[0].count) > 0 || parseInt(checkTransactions.rows[1].count) > 0) {
      const accounts = await models.Account.findAll();
      
      return res.status(400).render('accounts', { 
        title: 'Manage Accounts',
        accounts: accounts,
        error: 'Cannot delete account with associated transactions',
        success: null
      });
    }
    
    // Delete account using ORM
    await models.Account.delete(id);
    
    res.redirect('/accounts?success=Account deleted successfully');
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

// Reports dashboard
router.get('/reports', async (req, res, next) => {
  try {
    const userId = req.query.user_id || 1; // Default to user 1 for demo
    
    // Get data needed for filter dropdowns
    const accounts = await models.Account.findAll({ user_id: userId });
    const categories = await models.Category.findAll();
    
    // Get current date and date 30 days ago for default date range
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    res.render('reports', {
      title: 'Financial Reports',
      accounts,
      categories,
      defaultStartDate: startDate,
      defaultEndDate: endDate,
      reportData: null,
      error: null
    });
  } catch (err) {
    next(err);
  }
});

// Generate expense analysis report
router.post('/reports/generate', async (req, res, next) => {
  try {
    const { start_date, end_date, account_id, category_id } = req.body;
    const userId = req.body.user_id || 1; // Default to user 1 for demo
    
    if (!start_date || !end_date) {
      return res.status(400).redirect('/reports?error=Start and end dates are required');
    }
    
    // Build query based on filters
    let query = `
      SELECT 
        e.date,
        e.amount,
        e.description,
        c.name as category_name,
        a.name as account_name
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      JOIN accounts a ON e.account_id = a.id
      WHERE e.user_id = $1
        AND e.date BETWEEN $2 AND $3
    `;
    
    const queryParams = [userId, start_date, end_date];
    let paramIndex = 4;
    
    if (account_id && account_id !== 'all') {
      query += ` AND e.account_id = $${paramIndex}`;
      queryParams.push(account_id);
      paramIndex++;
    }
    
    if (category_id && category_id !== 'all') {
      query += ` AND e.category_id = $${paramIndex}`;
      queryParams.push(category_id);
      paramIndex++;
    }
    
    query += ` ORDER BY e.date DESC`;
    
    const expensesResult = await db.query(query, queryParams);
    
    // Get statistics data
    const stats = await calculateExpenseStats(userId, start_date, end_date, account_id, category_id);
    
    // Get data needed for filter dropdowns again
    const accounts = await models.Account.findAll({ user_id: userId });
    const categories = await models.Category.findAll();
    
    res.render('reports', {
      title: 'Financial Reports',
      accounts,
      categories,
      defaultStartDate: start_date,
      defaultEndDate: end_date,
      selectedAccount: account_id || 'all',
      selectedCategory: category_id || 'all',
      reportData: {
        expenses: expensesResult.rows,
        stats: stats
      },
      error: null
    });
  } catch (err) {
    console.error('Error generating report:', err);
    next(err);
  }
});

// Helper function to calculate expense statistics
async function calculateExpenseStats(userId, startDate, endDate, accountId, categoryId) {
  try {
    // Build base query for expenses matching the filters
    let baseQuery = `
      FROM expenses e
      WHERE e.user_id = $1
        AND e.date BETWEEN $2 AND $3
    `;
    
    const baseParams = [userId, startDate, endDate];
    let paramIndex = 4;
    
    if (accountId && accountId !== 'all') {
      baseQuery += ` AND e.account_id = $${paramIndex}`;
      baseParams.push(accountId);
      paramIndex++;
    }
    
    if (categoryId && categoryId !== 'all') {
      baseQuery += ` AND e.category_id = $${paramIndex}`;
      baseParams.push(categoryId);
      paramIndex++;
    }
    
    // Get total expense amount
    const totalQuery = `SELECT COALESCE(SUM(amount), 0) as total_amount ${baseQuery}`;
    const totalResult = await db.query(totalQuery, baseParams);
    
    // Get average expense amount
    const avgQuery = `SELECT COALESCE(AVG(amount), 0) as avg_amount ${baseQuery}`;
    const avgResult = await db.query(avgQuery, baseParams);
    
    // Get transaction count
    const countQuery = `SELECT COUNT(*) as transaction_count ${baseQuery}`;
    const countResult = await db.query(countQuery, baseParams);
    
    // Get max expense amount
    const maxQuery = `SELECT COALESCE(MAX(amount), 0) as max_amount ${baseQuery}`;
    const maxResult = await db.query(maxQuery, baseParams);
    
    // Get min expense amount (excluding zeros)
    const minQuery = `SELECT COALESCE(MIN(CASE WHEN amount > 0 THEN amount END), 0) as min_amount ${baseQuery}`;
    const minResult = await db.query(minQuery, baseParams);
    
    // Get category breakdown 
    const categoryQuery = `
      SELECT 
        c.name as category_name,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COUNT(e.id) as transaction_count
      FROM categories c
      LEFT JOIN expenses e ON c.id = e.category_id
        AND e.user_id = $1
        AND e.date BETWEEN $2 AND $3
        ${accountId && accountId !== 'all' ? `AND e.account_id = $${paramIndex-1}` : ''}
      WHERE c.type = 'expense'
        ${categoryId && categoryId !== 'all' ? `AND c.id = $${paramIndex-1}` : ''}
      GROUP BY c.name
      ORDER BY total_amount DESC
    `;
    
    const categoryResult = await db.query(categoryQuery, baseParams);
    
    // Calculate days in the period
    const days = Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
    
    return {
      total_amount: parseFloat(totalResult.rows[0].total_amount),
      avg_amount: parseFloat(avgResult.rows[0].avg_amount),
      transaction_count: parseInt(countResult.rows[0].transaction_count),
      max_amount: parseFloat(maxResult.rows[0].max_amount),
      min_amount: parseFloat(minResult.rows[0].min_amount),
      days_in_period: days,
      daily_average: parseFloat(totalResult.rows[0].total_amount) / days,
      category_breakdown: categoryResult.rows.map(row => ({
        ...row,
        total_amount: parseFloat(row.total_amount)
      }))
    };
  } catch (error) {
    console.error('Error calculating expense stats:', error);
    throw error;
  }
}

module.exports = router; 