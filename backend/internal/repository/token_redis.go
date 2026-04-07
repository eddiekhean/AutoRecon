package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// --- Refresh Token ---
// Key pattern: refresh_token:<refreshTokenValue>
// Value: <userID> (opaque UUID — no sensitive data embedded)

// StoreRefreshToken saves a refresh token in Redis.
func StoreRefreshToken(refreshToken, userID string, expiration time.Duration) error {
	key := fmt.Sprintf("refresh_token:%s", refreshToken)
	return SetToken(key, userID, expiration)
}

// GetRefreshTokenOwner retrieves the userID associated with a refresh token.
// Returns ("", err) if the token doesn't exist or has expired.
func GetRefreshTokenOwner(refreshToken string) (string, error) {
	key := fmt.Sprintf("refresh_token:%s", refreshToken)
	return GetToken(key)
}

// DeleteRefreshToken removes a refresh token from Redis (used on logout or rotation).
func DeleteRefreshToken(refreshToken string) error {
	key := fmt.Sprintf("refresh_token:%s", refreshToken)
	return DeleteToken(key)
}

// StoreUserSession saves an access token session in Redis.
// Key pattern: access_token:<userID>:<jti>
func StoreUserSession(userID, jti string, expiration time.Duration) error {
	key := fmt.Sprintf("access_token:%s:%s", userID, jti)
	return SetToken(key, "1", expiration)
}

// DeleteUserSession removes a specific session from Redis.
func DeleteUserSession(userID, jti string) error {
	key := fmt.Sprintf("access_token:%s:%s", userID, jti)
	return DeleteToken(key)
}

// DeleteAllUserSessions removes all active sessions for a given user from Redis.
// Called when an admin sets a user's status to INACTIVE (fired/blocked).
func DeleteAllUserSessions(userID string) error {
	if RedisClient == nil {
		return fmt.Errorf("RedisClient is not initialized")
	}
	pattern := fmt.Sprintf("access_token:%s:*", userID)

	var cursor uint64
	for {
		keys, nextCursor, err := RedisClient.Scan(context.Background(), cursor, pattern, 100).Result()
		if err != nil {
			return fmt.Errorf("failed to scan Redis keys: %w", err)
		}
		if len(keys) > 0 {
			if err := RedisClient.Del(context.Background(), keys...).Err(); err != nil {
				return fmt.Errorf("failed to delete Redis keys: %w", err)
			}
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return nil
}

// SetToken stores a token in Redis with an expiration time.
func SetToken(key string, token string, expiration time.Duration) error {
	if RedisClient == nil {
		return fmt.Errorf("RedisClient is not initialized")
	}
	return RedisClient.Set(RedisCtx, key, token, expiration).Err()
}

// GetToken retrieves a token from Redis by key.
func GetToken(key string) (string, error) {
	if RedisClient == nil {
		return "", fmt.Errorf("RedisClient is not initialized")
	}
	return RedisClient.Get(RedisCtx, key).Result()
}

// DeleteToken removes a token from Redis.
func DeleteToken(key string) error {
	if RedisClient == nil {
		return fmt.Errorf("RedisClient is not initialized")
	}
	return RedisClient.Del(RedisCtx, key).Err()
}

// IsSessionActive checks whether an access token session still exists in Redis (whitelist model).
//
// This single check replaces the old blacklist approach and correctly handles all revocation paths:
//   - Logout              → DeleteUserSession removes the key → (false, nil)
//   - Password change     → DeleteAllUserSessions removes all keys → (false, nil)
//   - Admin deactivation  → DeleteAllUserSessions removes all keys → (false, nil)
//   - Redis unreachable   → fail-closed → (false, err) — caller must return 503
func IsSessionActive(userID, jti string) (bool, error) {
	key := fmt.Sprintf("access_token:%s:%s", userID, jti)
	_, err := GetToken(key)
	if err != nil {
		if err == redis.Nil {
			// Key doesn't exist → session was revoked or never stored
			return false, nil
		}
		// Redis error → fail-closed
		return false, fmt.Errorf("redis session check failed: %w", err)
	}
	return true, nil
}

