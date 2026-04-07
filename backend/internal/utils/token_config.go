package utils

import (
	"fmt"
	"time"
)

// Package-level TTL values, initialized from config at startup via SetTokenTTL.
var (
	AccessTokenTTL  time.Duration = 15 * time.Minute  // default fallback
	RefreshTokenTTL time.Duration = 7 * 24 * time.Hour // default fallback
)

// SetTokenTTL reads and parses the duration strings from config (e.g. "15m", "168h")
// and stores them for use across all token operations.
func SetTokenTTL(accessTTLStr, refreshTTLStr string) error {
	access, err := time.ParseDuration(accessTTLStr)
	if err != nil {
		return fmt.Errorf("invalid ACCESS_TOKEN_TTL format '%s': %w", accessTTLStr, err)
	}
	refresh, err := time.ParseDuration(refreshTTLStr)
	if err != nil {
		return fmt.Errorf("invalid REFRESH_TOKEN_TTL format '%s': %w", refreshTTLStr, err)
	}
	AccessTokenTTL = access
	RefreshTokenTTL = refresh
	return nil
}
