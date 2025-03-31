const express = require('express');
const router = express.Router();
const db = require('../db');

// Get monthly expenses summary by category
router.get('/monthly-expenses', async (req, res, next) => {
  try {
    const { user_id, year, month } = req.query;
    const userId = user_id || 1; // Default to user 1 for demo
    
    // Validate input
    if (!year || !month) {
      return res.status(400).json({ message: 'Year and month are required' });
    }
    
    // Convert month to number and validate
    const monthNum = parseInt(month);
    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ message: 'Month must be between 1 and 12' });
    }
    
    // Get start and end date for the month
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0]; // Last day of month
    
    const query = `
      SELECT 
        c.id AS category_id,
        c.name AS category_name,
        COALESCE(SUM(e.amount), 0) AS total_amount,
        COUNT(e.id) AS transaction_count
      FROM categories c
      LEFT JOIN expenses e ON c.id = e.category_id 
        AND e.user_id = $1 
        AND e.date >= $2 
        AND e.date <= $3
      WHERE c.type = 'expense'
      GROUP BY c.id, c.name
      ORDER BY total_amount DESC
    `;
    
    const result = await db.query(query, [userId, startDate, endDate]);
    
    // Calculate total
    const total = result.rows.reduce((sum, row) => sum + parseFloat(row.total_amount), 0);
    
    res.json({
      period: {
        year: parseInt(year),
        month: monthNum,
        start_date: startDate,
        end_date: endDate
      },
      total_expenses: total,
      categories: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// Get monthly income summary by category
router.get('/monthly-income', async (req, res, next) => {
  try {
    const { user_id, year, month } = req.query;
    const userId = user_id || 1; // Default to user 1 for demo
    
    // Validate input
    if (!year || !month) {
      return res.status(400).json({ message: 'Year and month are required' });
    }
    
    // Convert month to number and validate
    const monthNum = parseInt(month);
    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ message: 'Month must be between 1 and 12' });
    }
    
    // Get start and end date for the month
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0]; // Last day of month
    
    const query = `
      SELECT 
        c.id AS category_id,
        c.name AS category_name,
        COALESCE(SUM(i.amount), 0) AS total_amount,
        COUNT(i.id) AS transaction_count
      FROM categories c
      LEFT JOIN incomes i ON c.id = i.category_id 
        AND i.user_id = $1 
        AND i.date >= $2 
        AND i.date <= $3
      WHERE c.type = 'income'
      GROUP BY c.id, c.name
      ORDER BY total_amount DESC
    `;
    
    const result = await db.query(query, [userId, startDate, endDate]);
    
    // Calculate total
    const total = result.rows.reduce((sum, row) => sum + parseFloat(row.total_amount), 0);
    
    res.json({
      period: {
        year: parseInt(year),
        month: monthNum,
        start_date: startDate,
        end_date: endDate
      },
      total_income: total,
      categories: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// Get cash flow for a specific period (income vs expenses)
router.get('/cash-flow', async (req, res, next) => {
  try {
    const { user_id, start_date, end_date, group_by } = req.query;
    const userId = user_id || 1; // Default to user 1 for demo
    
    // Validate input
    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }
    
    // Define grouping (month, week, day)
    const grouping = group_by || 'month';
    let dateFormat;
    
    switch (grouping) {
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'week':
        dateFormat = 'IYYY-IW'; // ISO year and week
        break;
      case 'month':
      default:
        dateFormat = 'YYYY-MM';
        break;
    }
    
    const query = `
      WITH income_data AS (
        SELECT 
          TO_CHAR(date, '${dateFormat}') AS period,
          COALESCE(SUM(amount), 0) AS total_income
        FROM incomes
        WHERE user_id = $1 AND date >= $2 AND date <= $3
        GROUP BY period
      ),
      expense_data AS (
        SELECT 
          TO_CHAR(date, '${dateFormat}') AS period,
          COALESCE(SUM(amount), 0) AS total_expenses
        FROM expenses
        WHERE user_id = $1 AND date >= $2 AND date <= $3
        GROUP BY period
      ),
      periods AS (
        SELECT DISTINCT period FROM (
          SELECT period FROM income_data
          UNION
          SELECT period FROM expense_data
        ) AS combined
      )
      SELECT 
        p.period,
        COALESCE(i.total_income, 0) AS income,
        COALESCE(e.total_expenses, 0) AS expenses,
        COALESCE(i.total_income, 0) - COALESCE(e.total_expenses, 0) AS net
      FROM periods p
      LEFT JOIN income_data i ON p.period = i.period
      LEFT JOIN expense_data e ON p.period = e.period
      ORDER BY p.period
    `;
    
    const result = await db.query(query, [userId, start_date, end_date]);
    
    // Calculate totals
    const totalIncome = result.rows.reduce((sum, row) => sum + parseFloat(row.income), 0);
    const totalExpenses = result.rows.reduce((sum, row) => sum + parseFloat(row.expenses), 0);
    const netCashFlow = totalIncome - totalExpenses;
    
    res.json({
      period: {
        start_date,
        end_date,
        grouping
      },
      totals: {
        income: totalIncome,
        expenses: totalExpenses,
        net: netCashFlow
      },
      cash_flow: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// Get account balance history
router.get('/account-balance-history', async (req, res, next) => {
  try {
    const { account_id, start_date, end_date, interval } = req.query;
    
    // Validate input
    if (!account_id) {
      return res.status(400).json({ message: 'Account ID is required' });
    }
    
    // Default dates if not provided
    const endDate = end_date || new Date().toISOString().split('T')[0];
    // Default to 6 months before end date if not provided
    const startDate = start_date || new Date(new Date(endDate).setMonth(new Date(endDate).getMonth() - 6)).toISOString().split('T')[0];
    
    // Define grouping interval (daily, weekly, monthly)
    const groupInterval = interval || 'monthly';
    let dateFormat;
    
    switch (groupInterval) {
      case 'daily':
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'weekly':
        dateFormat = 'IYYY-IW'; // ISO year and week
        break;
      case 'monthly':
      default:
        dateFormat = 'YYYY-MM';
        break;
    }
    
    // Get the account to verify it exists
    const accountResult = await db.query('SELECT * FROM accounts WHERE id = $1', [account_id]);
    
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    const account = accountResult.rows[0];
    
    // Use a window function to calculate running balance
    const query = `
      WITH transactions AS (
        SELECT 
          date,
          'expense' AS type,
          -amount AS amount
        FROM expenses 
        WHERE account_id = $1 AND date >= $2 AND date <= $3
        
        UNION ALL
        
        SELECT 
          date,
          'income' AS type,
          amount
        FROM incomes 
        WHERE account_id = $1 AND date >= $2 AND date <= $3
      ),
      daily_balance AS (
        SELECT 
          date,
          SUM(amount) AS daily_change,
          SUM(SUM(amount)) OVER (ORDER BY date) AS running_total
        FROM transactions
        GROUP BY date
        ORDER BY date
      )
      SELECT 
        TO_CHAR(date, '${dateFormat}') AS period,
        SUM(daily_change) AS period_change,
        MAX(running_total) AS ending_balance
      FROM daily_balance
      GROUP BY period
      ORDER BY period
    `;
    
    const result = await db.query(query, [account_id, startDate, endDate]);
    
    // Calculate the starting balance by subtracting all changes from current balance
    const totalChange = result.rows.reduce((sum, row) => sum + parseFloat(row.period_change), 0);
    const startingBalance = parseFloat(account.balance) - totalChange;
    
    // Add starting balance to running totals
    const balanceHistory = result.rows.map((row, index) => {
      let runningBalance = startingBalance;
      for (let i = 0; i <= index; i++) {
        runningBalance += parseFloat(result.rows[i].period_change);
      }
      return {
        period: row.period,
        change: parseFloat(row.period_change),
        balance: runningBalance
      };
    });
    
    res.json({
      account: {
        id: account.id,
        name: account.name,
        current_balance: parseFloat(account.balance)
      },
      period: {
        start_date: startDate,
        end_date: endDate,
        interval: groupInterval
      },
      starting_balance: startingBalance,
      ending_balance: parseFloat(account.balance),
      history: balanceHistory
    });
  } catch (err) {
    next(err);
  }
});

// Get breakdown of expenses by category for a specified period
router.get('/expense-breakdown', async (req, res, next) => {
  try {
    const { user_id, start_date, end_date } = req.query;
    const userId = user_id || 1; // Default to user 1 for demo
    
    // Validate input
    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }
    
    // Call our database function for category expenses
    const result = await db.query(
      'SELECT * FROM get_expenses_by_category($1, $2, $3)',
      [userId, start_date, end_date]
    );
    
    // Calculate total
    const total = result.rows.reduce((sum, row) => sum + parseFloat(row.total_amount), 0);
    
    // Add percentage to each category
    const categoriesWithPercentage = result.rows.map(row => ({
      ...row,
      percentage: total > 0 ? (parseFloat(row.total_amount) / total * 100).toFixed(2) : 0
    }));
    
    res.json({
      period: {
        start_date,
        end_date
      },
      total_expenses: total,
      categories: categoriesWithPercentage
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router; 