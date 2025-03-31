# SpendSight

A database-focused financial management application built with Express.js and PostgreSQL.

## Features

- **Account Management:** Track multiple financial accounts and their balances
- **Expense Tracking:** Record and categorize expenses
- **Income Recording:** Track various income sources
- **Financial Reports:** Generate insights with advanced SQL queries
- **Transaction Management:** Use database transactions for data integrity

## Database Features Demonstrated

- **Relational Database Design:** Well-structured schema with appropriate relationships
- **Indexing:** Strategic indexes for query performance
- **SQL Queries:** Complex joins, subqueries, and aggregations
- **Stored Procedures:** For handling complex operations like transfers
- **Transactions:** Ensuring data integrity during multi-step operations
- **Window Functions:** For advanced analytics and reporting

## Tech Stack

- **Backend:** Node.js with Express
- **Database:** PostgreSQL
- **View Engine:** EJS templates
- **Styling:** Bootstrap CSS

## Getting Started

### Prerequisites

- Node.js (v16+)
- PostgreSQL (v12+)

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd spendsight-express
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create .env file with your PostgreSQL credentials:
   ```
   PORT=3000
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=spendsight
   ```

4. Initialize the database:
   ```
   node src/db/init.js
   ```

5. Start the application:
   ```
   npm run dev
   ```

6. Visit http://localhost:3000 in your browser

## API Endpoints

### Accounts
- `GET /api/accounts` - Get all accounts
- `GET /api/accounts/:id` - Get specific account
- `POST /api/accounts` - Create account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account
- `POST /api/accounts/transfer` - Transfer between accounts

### Expenses
- `GET /api/expenses` - Get expenses with filters
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense

### Incomes
- `GET /api/incomes` - Get incomes with filters
- `POST /api/incomes` - Create income

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category

### Reports
- `GET /api/reports/expenses-by-category` - Get expense summary by category
- `GET /api/reports/monthly-expenses` - Get monthly expense summary
- `GET /api/reports/income-vs-expenses` - Compare income and expenses
- `GET /api/reports/account-balance-history` - Get account balance history 