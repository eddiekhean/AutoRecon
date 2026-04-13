package utils

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"os"

	"golang.org/x/crypto/bcrypt"
)

// HashPassword hashes a plain string password using bcrypt
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

// CheckPasswordHash compares a raw password with a bcrypt hash
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// HMACRefreshToken returns an HMAC-SHA256 hex digest of a raw refresh token value.
// Redis stores this digest as the key — never the raw UUID.
// Requires REFRESH_TOKEN_HMAC_KEY environment variable.
func HMACRefreshToken(raw string) string {
	key := []byte(os.Getenv("REFRESH_TOKEN_HMAC_KEY"))
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(raw))
	return hex.EncodeToString(mac.Sum(nil))
}
