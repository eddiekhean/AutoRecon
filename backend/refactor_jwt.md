You are a senior backend engineer specializing in authentication systems, distributed systems, and database design.

Your task is to completely remove Redis and refactor the system to use SQL Server as the single source of truth for:

Refresh token management
Session management
Token rotation & reuse detection
1. Core Objectives
Eliminate Redis entirely from the codebase and infrastructure.
Re-implement all Redis-based logic using SQL Server with transactional guarantees.
Maintain security parity or better compared to the Redis implementation.
Ensure no race conditions in token rotation.
Optimize for performance and scalability within SQL constraints.
2. Database Design (CRITICAL)
2.1 Tables
refresh_tokens
id (PK)
user_id (indexed)
token_hash (UNIQUE, indexed) ← MUST store hashed token (SHA256)
expires_at (indexed)
created_at
rotated_from (nullable)
retired_tokens
id (PK)
token_hash (indexed)
user_id (indexed)
expires_at (indexed)
user_sessions (OPTIONAL – see section 6)
id (PK)
user_id (indexed)
jti (UNIQUE, indexed)
expires_at (indexed)
2.2 Index Requirements (MANDATORY)

Create indexes for:

token_hash
user_id
expires_at
jti (if sessions enabled)
2.3 Security Rules
NEVER store raw tokens.
ALWAYS store:
token_hash = SHA256(token)
All lookups must be done using hashed values.
3. Token Rotation Logic (CRITICAL – MUST BE ATOMIC)

You MUST implement rotation using SQL TRANSACTION.

Flow:
Hash incoming refresh token
BEGIN TRANSACTION
Validate token exists in refresh_tokens AND not expired
Check token NOT in retired_tokens
Generate new refresh token
Insert new token into refresh_tokens
Move old token:
Delete from refresh_tokens
Insert into retired_tokens
COMMIT
3.1 Reuse Detection (SECURITY CRITICAL)

If a token is found in retired_tokens:

Treat as token reuse attack
Immediately:
Revoke ALL sessions of the user
Delete all refresh tokens of the user
4. Repository Layer Refactor
CREATE:
token_repository.go
Use SQL transactions for rotation
Methods:
RotateRefreshToken()
ValidateRefreshToken()
RevokeAllUserSessions()
CleanupExpiredTokens()
DELETE:
token_redis.go
redis.go
5. Background Cleanup Worker

Since SQL Server has no TTL:

Implement:
A background goroutine in main.go
Behavior:
Runs every 30 minutes
Deletes expired:
refresh_tokens
retired_tokens
user_sessions (if used)
Use batch delete:
Avoid full table locks
Delete in chunks (e.g., TOP 1000 per run)
6. Session Strategy (IMPORTANT DECISION)

You must choose ONE:

Option A (Recommended – Simpler, Faster)
DO NOT use user_sessions table
Access token is fully stateless (JWT)
Only validate refresh tokens in DB
Option B (More Secure, Slower)
Use user_sessions table (whitelist)
Validate jti on every request
If Option B:
Add in-memory cache (map with TTL ~5 minutes)
Reduce DB load

Default to Option A unless explicitly required

7. Performance Constraints
Minimize DB queries per request
NEVER query DB for access token validation (Option A)
Use proper indexing
Avoid N+1 queries
8. Configuration Changes
MODIFY:
config.go → remove Redis config
.env → remove Redis variables
MODIFY:
main.go:
Remove Redis initialization
Add Cleanup Worker
9. Verification Requirements
Automated:
Test token rotation (no race condition)
Test reuse detection
Test expired token rejection
Manual:
Login
Refresh token
Reuse old token → must trigger full revoke
Logout
10. Output Requirements
Provide:
Updated SQL schema (init.sql)
Full implementation of token_repository.go
Updated main.go
Explain:
How transaction prevents race condition
How reuse detection works
Performance considerations
11. Constraints
DO NOT modify API contracts
DO NOT change authentication flow behavior
ONLY replace Redis with SQL Server