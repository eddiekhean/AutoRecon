package utils

import (
	"crypto/rsa"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	privateKey *rsa.PrivateKey
	publicKey  *rsa.PublicKey
)

// CustomClaims embeds JWT registered claims along with app-specific fields.
type CustomClaims struct {
	RoleID                 int    `json:"role_id"`
	RequiresPasswordChange bool   `json:"requires_password_change"`
	JTI                    string `json:"jti"` // Unique session ID for Redis tracking
	jwt.RegisteredClaims
}

// LoadKeys loads the RSA private and public keys from the provided file paths.
func LoadKeys(privatePath, publicPath string) error {
	privBytes, err := os.ReadFile(privatePath)
	if err != nil {
		return fmt.Errorf("could not read private key file: %w", err)
	}
	privKey, err := jwt.ParseRSAPrivateKeyFromPEM(privBytes)
	if err != nil {
		return fmt.Errorf("could not parse private key: %w", err)
	}
	privateKey = privKey

	pubBytes, err := os.ReadFile(publicPath)
	if err != nil {
		return fmt.Errorf("could not read public key file: %w", err)
	}
	pubKey, err := jwt.ParseRSAPublicKeyFromPEM(pubBytes)
	if err != nil {
		return fmt.Errorf("could not parse public key: %w", err)
	}
	publicKey = pubKey

	return nil
}

// GenerateToken creates a signed RS256 JWT with role and session tracking.
func GenerateToken(userID string, roleID int, requiresPasswordChange bool, duration time.Duration) (string, string, error) {
	if privateKey == nil {
		return "", "", fmt.Errorf("private key is not initialized")
	}

	jti := uuid.New().String()
	now := time.Now()

	claims := CustomClaims{
		RoleID:                 roleID,
		RequiresPasswordChange: requiresPasswordChange,
		JTI:                    jti,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "autorecon-api",
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(duration)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signedToken, err := token.SignedString(privateKey)
	if err != nil {
		return "", "", fmt.Errorf("failed to sign token: %w", err)
	}

	// Return both the token string and its jti for Redis session store
	return signedToken, jti, nil
}

// ValidateToken parses and validates a JWT token, returning its CustomClaims.
func ValidateToken(tokenString string) (*CustomClaims, error) {
	if publicKey == nil {
		return nil, fmt.Errorf("public key is not initialized")
	}

	token, err := jwt.ParseWithClaims(tokenString, &CustomClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return publicKey, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse/validate token: %w", err)
	}

	if claims, ok := token.Claims.(*CustomClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token claims")
}
