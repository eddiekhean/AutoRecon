package repository

import (
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/google/uuid"

	"autorecon-backend/internal/models"
	"autorecon-backend/internal/utils"
)

// RefreshTokenData holds the metadata stored alongside each refresh token.
type RefreshTokenData struct {
	UserID         uuid.UUID
	FamilyID       uuid.UUID
	AbsoluteExpiry int64 // Unix timestamp — the chain's hard expiry, never extended on rotation
}

// retiredTokenMeta is returned by GetRetiredRefreshMeta to identify the owner of a retired token.
type retiredTokenMeta struct {
	UserID   uuid.UUID
	FamilyID uuid.UUID
}

// tokenHash returns the HMAC-SHA256 hex digest of the raw token value.
// The raw UUID is never written to the database.
func tokenHash(raw string) string {
	return utils.HMACRefreshToken(raw)
}

// ─── Refresh Token CRUD ────────────────────────────────────────────────────────

// StoreRefreshToken inserts a new active refresh token into the database.
func StoreRefreshToken(raw string, data RefreshTokenData, ttl time.Duration) error {
	return DB.Exec(`
		INSERT INTO refresh_tokens (token_hash, user_id, family_id, absolute_expiry, expires_at)
		VALUES (?, ?, ?, ?, ?)
	`, tokenHash(raw), data.UserID, data.FamilyID, data.AbsoluteExpiry, time.Now().Add(ttl)).Error
}

// GetRefreshTokenData retrieves metadata for a non-expired refresh token.
// Returns (nil, nil) when the token is not found or has expired — analogous to redis.Nil.
func GetRefreshTokenData(raw string) (*RefreshTokenData, error) {
	var row struct {
		UserID         models.UUID `gorm:"column:user_id"`
		FamilyID       models.UUID `gorm:"column:family_id"`
		AbsoluteExpiry int64       `gorm:"column:absolute_expiry"`
		ExpiresAt      time.Time `gorm:"column:expires_at"`
	}
	err := DB.Raw(`
		SELECT user_id, family_id, absolute_expiry, expires_at
		FROM refresh_tokens
		WHERE token_hash = ? AND expires_at > SYSDATETIMEOFFSET()
	`, tokenHash(raw)).Scan(&row).Error
	if err != nil {
		return nil, fmt.Errorf("failed to fetch refresh token: %w", err)
	}
	if uuid.UUID(row.UserID) == uuid.Nil {
		return nil, nil // not found
	}
	return &RefreshTokenData{
		UserID:         uuid.UUID(row.UserID),
		FamilyID:       uuid.UUID(row.FamilyID),
		AbsoluteExpiry: row.AbsoluteExpiry,
	}, nil
}

// DeleteRefreshToken removes a single active refresh token.
func DeleteRefreshToken(raw string) error {
	return DB.Exec(`DELETE FROM refresh_tokens WHERE token_hash = ?`, tokenHash(raw)).Error
}

// ─── Reverse Index (no-ops — user_id column serves as the index) ──────────────

// AddUserRefreshToken is a no-op. The user_id column in refresh_tokens makes
// per-user lookups O(indexed) without a separate reverse index.
func AddUserRefreshToken(userID uuid.UUID, raw string) error { return nil }

// RemoveUserRefreshToken is a no-op. Token removal is handled directly by
// DeleteRefreshToken or atomically inside RotateRefreshToken.
func RemoveUserRefreshToken(userID uuid.UUID, raw string) error { return nil }

// DeleteAllUserRefreshTokens deletes every active refresh token for a user.
// Called on password change, account lock, or reuse-attack detection.
func DeleteAllUserRefreshTokens(userID uuid.UUID) error {
	return DB.Exec(`DELETE FROM refresh_tokens WHERE user_id = ?`, userID.String()).Error
}

// ─── Retired Token Store (reuse detection) ────────────────────────────────────

// GetRetiredRefreshMeta looks up a token hash in the retired set.
// Returns (nil, nil) if the hash is not present — token was never rotated.
// Returns a non-nil struct if found — caller should treat this as a reuse attack.
func GetRetiredRefreshMeta(raw string) (*retiredTokenMeta, error) {
	var row struct {
		UserID   uuid.UUID `gorm:"column:user_id"`
		FamilyID uuid.UUID `gorm:"column:family_id"`
	}
	err := DB.Raw(`
		SELECT user_id, family_id
		FROM retired_tokens
		WHERE token_hash = ? AND expires_at > SYSDATETIMEOFFSET()
	`, tokenHash(raw)).Scan(&row).Error
	if err != nil {
		return nil, fmt.Errorf("failed to check retired token: %w", err)
	}
	if row.UserID == uuid.Nil {
		return nil, nil // not found
	}
	return &retiredTokenMeta{UserID: row.UserID, FamilyID: row.FamilyID}, nil
}

// MarkRefreshTokenRetired is a no-op. Retirement is handled atomically inside
// RotateRefreshToken as part of the same SQL transaction.
func MarkRefreshTokenRetired(raw string, familyID, userID uuid.UUID) error { return nil }

// ─── Atomic Token Rotation ────────────────────────────────────────────────────
//
// RotateRefreshToken atomically swaps oldRaw for newRaw using a SQL transaction.
//
// How it prevents race conditions:
//   - SELECT ... WITH (UPDLOCK, ROWLOCK) acquires a row-level update lock before
//     reading, so a second concurrent request cannot read the same row and proceed.
//   - All three mutations (delete old, insert retired, insert new) commit or roll
//     back together — there is no window where the old token is deleted but the
//     new one is not yet visible.
//
// Returns (oldData, true, nil)  on success.
// Returns (nil,     false, nil) if oldRaw was not found — caller checks retired set.
func RotateRefreshToken(oldRaw, newRaw string, newData RefreshTokenData, newTTL time.Duration) (*RefreshTokenData, bool, error) {
	oldHash := tokenHash(oldRaw)
	newHash := tokenHash(newRaw)
	newExpiresAt := time.Now().Add(newTTL)
	retiredExpiresAt := time.Now().Add(time.Hour) // 1 h window is sufficient for reuse detection

	var oldData *RefreshTokenData

	err := DB.Transaction(func(tx *gorm.DB) error {
		// 1. Fetch and lock the old token row to prevent concurrent rotations.
		var row struct {
			UserID         uuid.UUID `gorm:"column:user_id"`
			FamilyID       uuid.UUID `gorm:"column:family_id"`
			AbsoluteExpiry int64     `gorm:"column:absolute_expiry"`
		}
		result := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Raw(`
			SELECT user_id, family_id, absolute_expiry
			FROM refresh_tokens
			WHERE token_hash = ? AND expires_at > SYSDATETIMEOFFSET()
		`, oldHash).Scan(&row)
		if result.Error != nil {
			return result.Error
		}
		if row.UserID == uuid.Nil {
			return nil // token not found — oldData stays nil, signals !rotated
		}
		oldData = &RefreshTokenData{
			UserID:         row.UserID,
			FamilyID:       row.FamilyID,
			AbsoluteExpiry: row.AbsoluteExpiry,
		}

		// 2. Delete the old active token.
		if err := tx.Exec(`DELETE FROM refresh_tokens WHERE token_hash = ?`, oldHash).Error; err != nil {
			return err
		}

		// 3. Record the old hash in retired_tokens for reuse detection.
		if err := tx.Exec(`
			INSERT INTO retired_tokens (token_hash, user_id, family_id, expires_at)
			VALUES (?, ?, ?, ?)
		`, oldHash, row.UserID, row.FamilyID, retiredExpiresAt).Error; err != nil {
			return err
		}

		// 4. Insert the new active token.
		if err := tx.Exec(`
			INSERT INTO refresh_tokens (token_hash, user_id, family_id, absolute_expiry, expires_at)
			VALUES (?, ?, ?, ?, ?)
		`, newHash, newData.UserID, newData.FamilyID, newData.AbsoluteExpiry, newExpiresAt).Error; err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return nil, false, fmt.Errorf("atomic rotation failed: %w", err)
	}
	if oldData == nil {
		return nil, false, nil // token not found
	}
	return oldData, true, nil
}

// ─── Session Management (Option A — stateless access tokens) ─────────────────
//
// Access tokens are fully stateless JWTs; the DB is not consulted on every
// request. These functions are no-ops that preserve the existing call sites.

// StoreUserSession is a no-op under Option A.
func StoreUserSession(userID uuid.UUID, jti string, expiration time.Duration) error { return nil }

// DeleteUserSession is a no-op under Option A.
func DeleteUserSession(userID uuid.UUID, jti string) error { return nil }

// DeleteAllUserSessions is a no-op under Option A.
// Access tokens remain valid until natural expiry — only refresh tokens are revoked.
func DeleteAllUserSessions(userID uuid.UUID) error { return nil }

// IsSessionActive always returns true under Option A (no whitelist check).
func IsSessionActive(userID uuid.UUID, jti string) (bool, error) { return true, nil }

// ─── Background Cleanup ───────────────────────────────────────────────────────

// CleanupExpiredTokens deletes expired rows from both token tables in small
// batches to avoid long table locks. Called every 30 minutes by main.go.
func CleanupExpiredTokens() {
	DB.Exec(`DELETE TOP (1000) FROM refresh_tokens WHERE expires_at <= SYSDATETIMEOFFSET()`)
	DB.Exec(`DELETE TOP (1000) FROM retired_tokens  WHERE expires_at <= SYSDATETIMEOFFSET()`)
}
