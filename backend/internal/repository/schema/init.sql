-- ============================================================
-- AutoRecon Schema — Microsoft SQL Server (T-SQL)
-- Migrated from PostgreSQL. Each block is idempotent.
-- ============================================================

-- ============================================================
-- 1. Table: roles
--    PostgreSQL used SERIAL PRIMARY KEY.
--    SQL Server: plain INT PRIMARY KEY (fixed-value lookup table,
--    no auto-increment needed; explicit IDs are inserted below).
-- ============================================================
IF OBJECT_ID(N'roles', N'U') IS NULL
BEGIN
    CREATE TABLE roles (
        id        INT          NOT NULL,
        role_name NVARCHAR(50) NOT NULL,
        CONSTRAINT PK_roles        PRIMARY KEY (id),
        CONSTRAINT UQ_roles_name   UNIQUE      (role_name)
    );
END;

-- Seed default roles (idempotent via MERGE).
-- PostgreSQL: INSERT ... ON CONFLICT DO NOTHING
-- SQL Server:  MERGE ... WHEN NOT MATCHED THEN INSERT
MERGE INTO roles AS target
USING (VALUES
    (1, N'ADMIN'),
    (2, N'SALE'),
    (3, N'ACCOUNTANT'),
    (4, N'IT')
) AS source (id, role_name)
ON target.id = source.id
WHEN NOT MATCHED THEN
    INSERT (id, role_name) VALUES (source.id, source.role_name);

-- ============================================================
-- 2. Table: users
--    PostgreSQL: UUID DEFAULT gen_random_uuid()
--    SQL Server:  UNIQUEIDENTIFIER DEFAULT NEWID()
--
--    PostgreSQL: BOOLEAN DEFAULT FALSE
--    SQL Server:  BIT DEFAULT 0
--
--    PostgreSQL: TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
--    SQL Server:  DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
--
--    PostgreSQL: ON DELETE RESTRICT (FK to roles)
--    SQL Server:  ON DELETE NO ACTION (equivalent — errors on violating delete)
-- ============================================================
IF OBJECT_ID(N'users', N'U') IS NULL
BEGIN
    CREATE TABLE users (
        id                      UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        full_name               NVARCHAR(255)    NOT NULL DEFAULT N'',
        email                   NVARCHAR(255)    NOT NULL,
        password_hash           NVARCHAR(255)    NOT NULL,
        requires_password_change BIT             NOT NULL DEFAULT 0,
        status                  NVARCHAR(20)     NOT NULL DEFAULT N'ACTIVE', -- ACTIVE | INACTIVE
        role_id                 INT              NOT NULL,
        created_at              DATETIMEOFFSET           DEFAULT SYSDATETIMEOFFSET(),
        updated_at              DATETIMEOFFSET           DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_users        PRIMARY KEY (id),
        CONSTRAINT UQ_users_email  UNIQUE      (email),
        CONSTRAINT FK_users_role   FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE NO ACTION
    );
END;

-- Trigger: keep updated_at current on every UPDATE.
-- PostgreSQL used a shared PL/pgSQL function called via EXECUTE PROCEDURE.
-- SQL Server: each table gets its own AFTER UPDATE trigger.
-- IMPORTANT: CREATE TRIGGER must be the first statement in a T-SQL batch.
-- Wrapping it in EXEC() satisfies that requirement inside a larger script.
IF OBJECT_ID(N'update_users_modtime', N'TR') IS NOT NULL
    DROP TRIGGER update_users_modtime;

EXEC(N'
CREATE TRIGGER update_users_modtime
ON users
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    -- RECURSIVE_TRIGGERS is OFF by default, so this UPDATE will not re-fire the trigger.
    UPDATE u
    SET    u.updated_at = SYSDATETIMEOFFSET()
    FROM   users AS u
    INNER JOIN inserted AS i ON u.id = i.id;
END
');

-- ============================================================
-- 3. Table: bank_transactions
-- ============================================================
IF OBJECT_ID(N'bank_transactions', N'U') IS NULL
BEGIN
    CREATE TABLE bank_transactions (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        bank_txn_id NVARCHAR(255)    NOT NULL,               -- unique; prevents duplicate bank API fetches
        amount      DECIMAL(15,2)    NOT NULL,
        description NVARCHAR(MAX),
        bank_date   DATETIMEOFFSET   NOT NULL,
        status      NVARCHAR(50)              DEFAULT N'Pending', -- Pending | Matched | Discrepancy
        created_at  DATETIMEOFFSET            DEFAULT SYSDATETIMEOFFSET(),
        updated_at  DATETIMEOFFSET            DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_bank_transactions           PRIMARY KEY (id),
        CONSTRAINT UQ_bank_transactions_txn_id    UNIQUE      (bank_txn_id)
    );
END;

IF OBJECT_ID(N'update_bank_transactions_modtime', N'TR') IS NOT NULL
    DROP TRIGGER update_bank_transactions_modtime;

EXEC(N'
CREATE TRIGGER update_bank_transactions_modtime
ON bank_transactions
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE bt
    SET    bt.updated_at = SYSDATETIMEOFFSET()
    FROM   bank_transactions AS bt
    INNER JOIN inserted AS i ON bt.id = i.id;
END
');

-- ============================================================
-- 4. Table: orders
--    Both FK columns use ON DELETE SET NULL — SQL Server supports
--    this when the cascading paths are distinct (different parent
--    tables), so no "multiple cascade paths" error.
-- ============================================================
IF OBJECT_ID(N'orders', N'U') IS NULL
BEGIN
    CREATE TABLE orders (
        id                     UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        unique_id              NVARCHAR(100)    NOT NULL,   -- ID used on QR code
        vin_number             NVARCHAR(100),
        amount                 DECIMAL(15,2)    NOT NULL,
        status                 NVARCHAR(50)              DEFAULT N'Open', -- Open | Auto-matched | Manual-matched
        created_by_user_id     UNIQUEIDENTIFIER          REFERENCES users(id)             ON DELETE SET NULL,
        matched_transaction_id UNIQUEIDENTIFIER          REFERENCES bank_transactions(id) ON DELETE SET NULL,
        created_at             DATETIMEOFFSET            DEFAULT SYSDATETIMEOFFSET(),
        updated_at             DATETIMEOFFSET            DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_orders       PRIMARY KEY (id),
        CONSTRAINT UQ_orders_uid   UNIQUE      (unique_id)
    );
END;

IF OBJECT_ID(N'update_orders_modtime', N'TR') IS NOT NULL
    DROP TRIGGER update_orders_modtime;

EXEC(N'
CREATE TRIGGER update_orders_modtime
ON orders
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE o
    SET    o.updated_at = SYSDATETIMEOFFSET()
    FROM   orders AS o
    INNER JOIN inserted AS i ON o.id = i.id;
END
');

-- ============================================================
-- 5. Table: audit_logs
--    PostgreSQL: JSONB  →  SQL Server: NVARCHAR(MAX)
--    Use SQL Server's JSON_VALUE() / ISJSON() functions to query
--    the JSON content stored in old_values / new_values.
-- ============================================================
IF OBJECT_ID(N'audit_logs', N'U') IS NULL
BEGIN
    CREATE TABLE audit_logs (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        user_id     UNIQUEIDENTIFIER          REFERENCES users(id)             ON DELETE SET NULL,
        action      NVARCHAR(255)    NOT NULL,
        order_id    UNIQUEIDENTIFIER NULL      REFERENCES orders(id)           ON DELETE SET NULL,
        bank_txn_id UNIQUEIDENTIFIER NULL      REFERENCES bank_transactions(id) ON DELETE SET NULL,
        old_values  NVARCHAR(MAX),  -- was JSONB; store JSON text, query with JSON_VALUE() / OPENJSON()
        new_values  NVARCHAR(MAX),  -- was JSONB; store JSON text, query with JSON_VALUE() / OPENJSON()
        created_at  DATETIMEOFFSET            DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_audit_logs PRIMARY KEY (id)
    );
END;

-- ============================================================
-- 6. Indexes
--    PostgreSQL: CREATE INDEX IF NOT EXISTS idx_name ON table(col)
--    SQL Server:  Conditional CREATE INDEX via sys.indexes lookup
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_orders_status' AND object_id = OBJECT_ID(N'orders')
)
    CREATE INDEX idx_orders_status ON orders(status);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_bank_transactions_status' AND object_id = OBJECT_ID(N'bank_transactions')
)
    CREATE INDEX idx_bank_transactions_status ON bank_transactions(status);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_audit_logs_order_id' AND object_id = OBJECT_ID(N'audit_logs')
)
    CREATE INDEX idx_audit_logs_order_id ON audit_logs(order_id);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_audit_logs_bank_txn_id' AND object_id = OBJECT_ID(N'audit_logs')
)
    CREATE INDEX idx_audit_logs_bank_txn_id ON audit_logs(bank_txn_id);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_users_status' AND object_id = OBJECT_ID(N'users')
)
    CREATE INDEX idx_users_status ON users(status);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_users_role_id' AND object_id = OBJECT_ID(N'users')
)
    CREATE INDEX idx_users_role_id ON users(role_id);

-- ============================================================
-- 7. Table: refresh_tokens
--    Stores active refresh tokens (hashed). Never stores raw values.
--    token_hash: HMAC-SHA256 of the raw token UUID.
--    absolute_expiry: Unix timestamp — never extended on rotation.
--    expires_at: sliding window expiry (capped by absolute_expiry).
-- ============================================================
IF OBJECT_ID(N'refresh_tokens', N'U') IS NULL
BEGIN
    CREATE TABLE refresh_tokens (
        id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        token_hash      NVARCHAR(64)     NOT NULL,
        user_id         NVARCHAR(36)     NOT NULL,
        family_id       NVARCHAR(36)     NOT NULL,
        absolute_expiry BIGINT           NOT NULL,
        expires_at      DATETIMEOFFSET   NOT NULL,
        created_at      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_refresh_tokens          PRIMARY KEY (id),
        CONSTRAINT UQ_refresh_tokens_hash     UNIQUE      (token_hash)
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_refresh_tokens_user_id' AND object_id = OBJECT_ID(N'refresh_tokens')
)
    CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_refresh_tokens_expires_at' AND object_id = OBJECT_ID(N'refresh_tokens')
)
    CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- ============================================================
-- 8. Table: retired_tokens
--    Stores recently rotated token hashes for reuse detection.
--    A token present here was already consumed in a rotation.
--    Presenting it again signals a token reuse attack.
-- ============================================================
IF OBJECT_ID(N'retired_tokens', N'U') IS NULL
BEGIN
    CREATE TABLE retired_tokens (
        id         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        token_hash NVARCHAR(64)     NOT NULL,
        user_id    NVARCHAR(36)     NOT NULL,
        family_id  NVARCHAR(36)     NOT NULL,
        expires_at DATETIMEOFFSET   NOT NULL,
        created_at DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_retired_tokens       PRIMARY KEY (id),
        CONSTRAINT UQ_retired_tokens_hash  UNIQUE      (token_hash)
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_retired_tokens_user_id' AND object_id = OBJECT_ID(N'retired_tokens')
)
    CREATE INDEX idx_retired_tokens_user_id ON retired_tokens(user_id);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_retired_tokens_expires_at' AND object_id = OBJECT_ID(N'retired_tokens')
)
    CREATE INDEX idx_retired_tokens_expires_at ON retired_tokens(expires_at);
