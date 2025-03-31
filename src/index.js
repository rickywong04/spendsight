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
const webRouter = require('./routes/web');

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
app.use('/', webRouter);

// Home route
app.get('/', (req, res) => {
  res.render('index', { 
    title: 'SpendSight - Financial Management',
    content: 'Welcome to SpendSight, your financial management application.'
  });
});

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = process.env.NODE_ENV === 'development' ? err : {};

  // Render the error page
  res.status(err.status || 500);
  
  // Check if the request is for the API
  if (req.path.startsWith('/api')) {
    return res.json({
      error: err.message,
      status: err.status || 500
    });
  }
  
  // Render error page for non-API requests
  res.render('error', { 
    title: 'Error',
    message: err.message,
    error: err
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app; 