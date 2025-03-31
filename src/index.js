const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Import routes
const accountsRouter = require('./routes/accounts');
const categoriesRouter = require('./routes/categories');
const expensesRouter = require('./routes/expenses');
const incomesRouter = require('./routes/incomes');
const reportsRouter = require('./routes/reports');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/api/accounts', accountsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/incomes', incomesRouter);
app.use('/api/reports', reportsRouter);

// Home route
app.get('/', (req, res) => {
  res.render('index', { 
    title: 'SpendSight - Financial Management',
    content: 'Welcome to SpendSight, your financial management application.'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app; 