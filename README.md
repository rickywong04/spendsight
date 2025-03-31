# SpendSight Financial Management Application

A database-focused financial management application built with Express.js and PostgreSQL. This application emphasizes database concepts including relational schema design, indexing, transactions, stored procedures, and advanced SQL queries.

## Features

- **User-friendly Interface**: Simple EJS templates with Bootstrap styling
- **Comprehensive API**: RESTful endpoints for all financial operations
- **PostgreSQL Database**: Leverages advanced PostgreSQL features
- **Transaction Support**: All financial operations use database transactions
- **Detailed Reporting**: Advanced SQL queries for financial insights

## Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL
- **Views**: EJS templates
- **Styling**: Bootstrap 5
- **API**: RESTful JSON API

## Prerequisites

- Node.js (v14+)
- PostgreSQL (v12+)
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/spendsight.git
   cd spendsight
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a PostgreSQL database:
   ```bash
   createdb spendsight
   ```

4. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update database connection details

5. Initialize the database:
   ```bash
   npm run db:init
   ```

6. Start the server:
   ```bash
   npm run dev
   ```

7. Access the application:
   - Open http://localhost:3000 in your browser

## Database Schema

The application uses the following database tables:

- **users**: Basic user information
- **accounts**: Financial accounts (checking, savings, credit cards)
- **categories**: Categories for expenses and incomes
- **expenses**: Individual expense transactions
- **incomes**: Individual income transactions

The schema includes foreign key relationships, appropriate indexes, and stored procedures for common operations.

## API Documentation

### Accounts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/accounts` | GET | List all accounts |
| `/api/accounts/:id` | GET | Get account details |
| `/api/accounts` | POST | Create new account |
| `/api/accounts/:id` | PUT | Update account |
| `/api/accounts/:id` | DELETE | Delete account |
| `/api/accounts/transfer` | POST | Transfer funds between accounts |

#### Example Request (Create Account)
```json
{
  "user_id": 1,
  "name": "Checking Account",
  "type": "checking",
  "balance": 1000
}
```

### Categories

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/categories` | GET | List all categories |
| `/api/categories/:id` | GET | Get category details |
| `/api/categories` | POST | Create new category |
| `/api/categories/:id` | PUT | Update category |
| `/api/categories/:id` | DELETE | Delete category |

#### Example Request (Create Category)
```json
{
  "name": "Groceries",
  "type": "expense"
}
```

### Expenses

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/expenses` | GET | List all expenses |
| `/api/expenses/:id` | GET | Get expense details |
| `/api/expenses` | POST | Create new expense |
| `/api/expenses/:id` | PUT | Update expense |
| `/api/expenses/:id` | DELETE | Delete expense |

#### Example Request (Create Expense)
```json
{
  "user_id": 1,
  "account_id": 1,
  "category_id": 3,
  "amount": 45.67,
  "description": "Weekly groceries",
  "date": "2023-06-15"
}
```

### Incomes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/incomes` | GET | List all incomes |
| `/api/incomes/:id` | GET | Get income details |
| `/api/incomes` | POST | Create new income |
| `/api/incomes/:id` | PUT | Update income |
| `/api/incomes/:id` | DELETE | Delete income |

#### Example Request (Create Income)
```json
{
  "user_id": 1,
  "account_id": 1,
  "category_id": 8,
  "amount": 2500,
  "description": "Monthly salary",
  "date": "2023-06-01"
}
```

### Reports

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reports/monthly-expenses` | GET | Monthly expenses by category |
| `/api/reports/monthly-income` | GET | Monthly income by category |
| `/api/reports/cash-flow` | GET | Cash flow analysis |
| `/api/reports/account-balance-history` | GET | Account balance history |
| `/api/reports/expense-breakdown` | GET | Expense breakdown by category |

#### Example Request (Monthly Expenses)
```
GET /api/reports/monthly-expenses?year=2023&month=6&user_id=1
```

## Database Features Showcase

This application showcases several advanced PostgreSQL features:

1. **Transactions**: All financial operations use transactions to ensure data integrity
2. **Stored Procedures**: Fund transfers use a stored procedure to ensure atomicity
3. **Indexes**: Strategic indexes on commonly queried columns for performance
4. **Complex Queries**: Reports use window functions, CTEs, and aggregations
5. **Database Functions**: Custom functions for common calculations

## Development

- Start development server:
  ```bash
  npm run dev
  ```

- Initialize/reset database:
  ```bash
  npm run db:init
  ```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- This project was created as a demonstration of database concepts with Express.js and PostgreSQL. 