-- Hàm Trigger dùng chung để cập nhật trường updated_at mỗi khi có UPDATE
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Table ROLES
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

-- Thêm quyền mặc định nếu chưa có
INSERT INTO roles (id, role_name) VALUES (1, 'Admin'), (2, 'Sale'), (3, 'Accountant'), (4, 'IT') ON CONFLICT DO NOTHING;

-- 2. Table USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT REFERENCES roles(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_users_modtime ON users;
CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- 3. Table BANK_TRANSACTIONS
CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_txn_id VARCHAR(255) NOT NULL UNIQUE, -- Unique index để chặn duplicate khi fetch API bank
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    bank_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending', -- Pending, Matched, Discrepancy
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_bank_transactions_modtime ON bank_transactions;
CREATE TRIGGER update_bank_transactions_modtime BEFORE UPDATE ON bank_transactions FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- 4. Table ORDERS
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unique_id VARCHAR(100) NOT NULL UNIQUE, -- ID dùng trên QR code
    vin_number VARCHAR(100),
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'Open', -- Open, Auto-matched, Manual-matched
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    matched_transaction_id UUID REFERENCES bank_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_orders_modtime ON orders;
CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON orders FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- 5. Table AUDIT_LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    order_id UUID NULL REFERENCES orders(id) ON DELETE SET NULL,
    bank_txn_id UUID NULL REFERENCES bank_transactions(id) ON DELETE SET NULL,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index phụ thêm để tăng tốc độ tìm kiếm cho màn hình reconciliation
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_order_id ON audit_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_bank_txn_id ON audit_logs(bank_txn_id);
