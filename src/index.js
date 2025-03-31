const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Home page route
app.get('/', (req, res) => {
  res.render('index', { title: 'SpendSight' });
});

// Dashboard page
app.get('/dashboard', (req, res) => {
  res.render('index', { title: 'Dashboard' });
});

// Accounts page
app.get('/accounts', (req, res) => {
  res.render('index', { title: 'Accounts' });
});

// Expenses page
app.get('/expenses', (req, res) => {
  res.render('index', { title: 'Expenses' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    title: 'Error',
    message: err.message || 'Something went wrong!' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { 
    title: '404 Not Found',
    message: 'The page you requested does not exist.'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 