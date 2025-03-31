const express = require('express');
const router = express.Router();
const db = require('../db');

// Get expense summary by category for a user
router.get('/expenses-by-category', async (req, res) => {
  try {
    const { user_id, start_date, end_date } = req.query;
    
    if (!user_id || !start_date || !end_date) {
      return res.status(400).json({
        error: 'Missing required parameters: user_id, start_date, end_date'
      });
    }
    
    // Using the stored function for category summary
    const result = await db.query(
      'SELECT * FROM get_expenses_by_category($1, $2, $3)',
      [user_id, start_date, end_date]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error generating expense category report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Get monthly expense summary
router.get('/monthly-expenses', async (req, res) => {
  try {
    const { user_id, year } = req.query;
    
    if (!user_id || !year) {
      return res.status(400).json({
        error: 'Missing required parameters: user_id, year'
      });
    }
    
    // Advanced SQL query with date manipulation and aggregation
    const result = await db.query(`
      SELECT 
        EXTRACT(MONTH FROM date) AS month,
        TO_CHAR(date, 'Month') AS month_name,
        SUM(amount) AS total_amount,
        COUNT(*) AS transaction_count
      FROM 
        expenses
      WHERE 
        user_id = $1
        AND EXTRACT(YEAR FROM date) = $2
      GROUP BY
        EXTRACT(MONTH FROM date),
        TO_CHAR(date, 'Month')
      ORDER BY
        month
    `, [user_id, year]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error generating monthly expense report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Get income vs expenses over time
router.get('/income-vs-expenses', async (req, res) => {
  try {
    const { user_id, period } = req.query;
    
    if (!user_id || !period) {
      return res.status(400).json({
        error: 'Missing required parameters: user_id, period (daily, monthly, yearly)'
      });
    }
    
    let dateFormat;
    let dateExtract;
    
    // Determine the date format and extraction based on period
    switch (period) {
      case 'daily':
        dateFormat = 'YYYY-MM-DD';
        dateExtract = 'date';
        break;
      case 'monthly':
        dateFormat = 'YYYY-MM';
        dateExtract = `TO_CHAR(date, 'YYYY-MM')`;
        break;
      case 'yearly':
        dateFormat = 'YYYY';
        dateExtract = `EXTRACT(YEAR FROM date)`;
        break;
      default:
        return res.status(400).json({
          error: 'Invalid period. Must be one of: daily, monthly, yearly'
        });
    }
    
    // Complex query with subqueries and joins
    const query = `
      WITH expense_data AS (
        SELECT 
          ${dateExtract} AS period,
          SUM(amount) AS total_expense
        FROM 
          expenses
        WHERE 
          user_id = $1
        GROUP BY 
          period
      ),
      income_data AS (
        SELECT 
          ${dateExtract} AS period,
          SUM(amount) AS total_income
        FROM 
          incomes
        WHERE 
          user_id = $1
        GROUP BY 
          period
      )
      SELECT 
        COALESCE(e.period, i.period) AS period,
        COALESCE(e.total_expense, 0) AS expenses,
        COALESCE(i.total_income, 0) AS income,
        COALESCE(i.total_income, 0) - COALESCE(e.total_expense, 0) AS net
      FROM 
        expense_data e
        FULL OUTER JOIN income_data i ON e.period = i.period
      ORDER BY 
        period
    `;
    
    const result = await db.query(query, [user_id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error generating income vs expenses report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Get account balance history
router.get('/account-balance-history', async (req, res) => {
  try {
    const { account_id, days = 30 } = req.query;
    
    if (!account_id) {
      return res.status(400).json({
        error: 'Missing required parameter: account_id'
      });
    }
    
    // Get the current balance
    const accountResult = await db.query(
      'SELECT balance FROM accounts WHERE id = $1',
      [account_id]
    );
    
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const currentBalance = accountResult.rows[0].balance;
    
    // Advanced query with window functions to calculate running balance
    const result = await db.query(`
      WITH all_transactions AS (
        SELECT 
          date,
          -amount AS amount,
          'expense' AS type,
          description
        FROM 
          expenses
        WHERE 
          account_id = $1
          AND date >= CURRENT_DATE - INTERVAL '${days} days'
        
        UNION ALL
        
        SELECT 
          date,
          amount,
          'income' AS type,
          description
        FROM 
          incomes
        WHERE 
          account_id = $1
          AND date >= CURRENT_DATE - INTERVAL '${days} days'
      ),
      daily_balance AS (
        SELECT
          date,
          SUM(amount) AS daily_change,
          SUM(SUM(amount)) OVER (ORDER BY date DESC) AS running_balance_reverse
        FROM
          all_transactions
        GROUP BY
          date
        ORDER BY
          date DESC
      )
      SELECT
        date,
        daily_change,
        $2 - running_balance_reverse AS balance
      FROM
        daily_balance
      ORDER BY
        date ASC
    `, [account_id, currentBalance]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error generating account balance history:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router; 