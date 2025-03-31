-- Drop tables if they exist
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS incomes;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS users;

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create accounts table
CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  balance DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table 
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'expense' or 'income'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create expenses table
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id),
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create incomes table
CREATE TABLE incomes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id),
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common query patterns
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_account_id ON expenses(account_id);
CREATE INDEX idx_expenses_category_id ON expenses(category_id);
CREATE INDEX idx_expenses_date ON expenses(date);

CREATE INDEX idx_incomes_user_id ON incomes(user_id);
CREATE INDEX idx_incomes_account_id ON incomes(account_id);
CREATE INDEX idx_incomes_category_id ON incomes(category_id);
CREATE INDEX idx_incomes_date ON incomes(date);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_categories_type ON categories(type);

-- Insert sample data

-- Sample Users
INSERT INTO users (name, email) VALUES 
('John Doe', 'john@example.com'),
('Jane Smith', 'jane@example.com');

-- Sample Categories
INSERT INTO categories (name, type) VALUES 
('Groceries', 'expense'),
('Dining', 'expense'),
('Utilities', 'expense'),
('Transportation', 'expense'),
('Entertainment', 'expense'),
('Salary', 'income'),
('Freelance', 'income'),
('Investment', 'income');

-- Sample Accounts
INSERT INTO accounts (user_id, name, type, balance) VALUES 
(1, 'Checking Account', 'checking', 2500.00),
(1, 'Savings Account', 'savings', 10000.00),
(1, 'Credit Card', 'credit', -450.00),
(2, 'Checking Account', 'checking', 3200.00),
(2, 'Savings Account', 'savings', 15000.00);

-- Sample Expenses
INSERT INTO expenses (user_id, account_id, category_id, amount, description, date) VALUES 
(1, 1, 1, 120.50, 'Weekly grocery shopping', CURRENT_DATE - INTERVAL '5 days'),
(1, 1, 2, 45.80, 'Dinner with friends', CURRENT_DATE - INTERVAL '3 days'),
(1, 3, 3, 85.40, 'Electricity bill', CURRENT_DATE - INTERVAL '7 days'),
(1, 1, 4, 35.00, 'Gas', CURRENT_DATE - INTERVAL '2 days'),
(2, 4, 1, 95.20, 'Grocery shopping', CURRENT_DATE - INTERVAL '4 days'),
(2, 4, 5, 65.00, 'Movie tickets', CURRENT_DATE - INTERVAL '1 day');

-- Sample Incomes
INSERT INTO incomes (user_id, account_id, category_id, amount, description, date) VALUES 
(1, 1, 6, 3500.00, 'Monthly salary', CURRENT_DATE - INTERVAL '15 days'),
(1, 2, 8, 250.00, 'Stock dividends', CURRENT_DATE - INTERVAL '10 days'),
(2, 4, 6, 4200.00, 'Monthly salary', CURRENT_DATE - INTERVAL '14 days'),
(2, 4, 7, 350.00, 'Website project', CURRENT_DATE - INTERVAL '5 days');

-- Create a stored procedure for transferring money between accounts
CREATE OR REPLACE PROCEDURE transfer_funds(
  p_from_account_id INTEGER,
  p_to_account_id INTEGER,
  p_amount DECIMAL(12, 2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the from account has sufficient funds
  IF (SELECT balance FROM accounts WHERE id = p_from_account_id) >= p_amount THEN
    -- Deduct from the source account
    UPDATE accounts 
    SET 
      balance = balance - p_amount,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = p_from_account_id;
    
    -- Add to the destination account
    UPDATE accounts 
    SET 
      balance = balance + p_amount,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = p_to_account_id;
    
    COMMIT;
  ELSE
    RAISE EXCEPTION 'Insufficient funds in source account';
  END IF;
END;
$$;

-- Create a function to get the total expenses by category for a user
CREATE OR REPLACE FUNCTION get_expenses_by_category(p_user_id INTEGER, p_start_date DATE, p_end_date DATE)
RETURNS TABLE (category_name VARCHAR, total_amount DECIMAL(12, 2))
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name AS category_name,
    SUM(e.amount) AS total_amount
  FROM 
    expenses e
    JOIN categories c ON e.category_id = c.id
  WHERE 
    e.user_id = p_user_id
    AND e.date BETWEEN p_start_date AND p_end_date
  GROUP BY 
    c.name
  ORDER BY 
    total_amount DESC;
END;
$$; 