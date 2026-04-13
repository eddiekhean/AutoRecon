package handlers

import (
	"net/http"
	"time"
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"autorecon-backend/internal/models"
	"autorecon-backend/internal/repository"
	"autorecon-backend/internal/utils"
)

// absoluteRefreshTTL is the maximum lifetime of any refresh token chain.
// Each rotation carries forward the same expiry — the chain cannot be extended.
const absoluteRefreshTTL = 30 * 24 * time.Hour

const refreshCookieName = "refresh_token"

// refreshCookiePath scopes the cookie to the auth endpoints.
// The browser only sends it to /api/v1/auth/refresh and /api/v1/auth/logout.
const refreshCookiePath = "/api/v1/auth"

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// setRefreshCookie writes the refresh token as an HttpOnly cookie.
// Secure flag is enabled in production (GIN_MODE=release) and disabled in dev.
func setRefreshCookie(c *gin.Context, value string, maxAge int) {
	secure := gin.Mode() == gin.ReleaseMode
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     refreshCookieName,
		Value:    value,
		Path:     refreshCookiePath,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteStrictMode,
	})
}

// clearRefreshCookie immediately expires the refresh token cookie.
func clearRefreshCookie(c *gin.Context) {
	setRefreshCookie(c, "", -1)
}

// Login authenticates a user and returns an access token.
// The refresh token is delivered as an HttpOnly cookie — it never appears in the
// response body and is therefore not accessible to JavaScript.
func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "Invalid request format: "+err.Error())
		return
	}

	var user models.User
	if err := repository.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		utils.Unauthorized(c, "Invalid email or password")
		return
	}

	if user.Status == "INACTIVE" {
		utils.Forbidden(c, "Your account has been deactivated. Please contact Admin.")
		return
	}

	if !utils.CheckPasswordHash(req.Password, user.PasswordHash) {
		utils.Unauthorized(c, "Invalid email or password")
		return
	}

	accessTTL := utils.AccessTokenTTL
	if user.RequiresPasswordChange {
		accessTTL = 15 * time.Minute
	}

	accessToken, jti, err := utils.GenerateToken(uuid.UUID(user.ID), user.RoleID, user.RequiresPasswordChange, accessTTL)
	if err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to generate access token")
		return
	}

	if err := repository.StoreUserSession(uuid.UUID(user.ID), jti, accessTTL); err != nil {
		c.Error(err)
	}

	responseData := gin.H{
		"access_token":             accessToken,
		"requires_password_change": user.RequiresPasswordChange,
	}

	// Only issue a refresh token if the account is fully active (not forced to change password).
	// Force-change logins get a short-lived access token only — no long-lived session.
	if !user.RequiresPasswordChange {
		rawToken := uuid.New().String()
		familyID := uuid.New()
		absExpiry := time.Now().Add(absoluteRefreshTTL).Unix()

		tokenData := repository.RefreshTokenData{
			UserID:         uuid.UUID(user.ID),
			FamilyID:       familyID,
			AbsoluteExpiry: absExpiry,
		}
		if err := repository.StoreRefreshToken(rawToken, tokenData, utils.RefreshTokenTTL); err != nil {
			c.Error(err)
			utils.InternalError(c, "Failed to store refresh token")
			return
		}
		setRefreshCookie(c, rawToken, int(utils.RefreshTokenTTL.Seconds()))
	}

	utils.Success(c, responseData)
}

// RefreshToken issues a new access token when given a valid refresh token cookie.
// Implements:
//   - Absolute expiry enforcement: chain cannot outlive its original TTL
//   - Token reuse detection: stale token presented → all sessions wiped
//   - Atomic rotation via SQL transaction: concurrent refresh requests cannot both succeed
//
// POST /api/v1/auth/refresh
func RefreshToken(c *gin.Context) {
	rawToken, err := c.Cookie(refreshCookieName)
	if err != nil || rawToken == "" {
		utils.Unauthorized(c, "Refresh token missing")
		return
	}

	tokenData, err := repository.GetRefreshTokenData(rawToken)
	if err != nil {
		utils.InternalError(c, "Failed to validate refresh token")
		return
	}
	if tokenData == nil {
		// Token not found in active set — check if it was recently rotated (reuse detection).
		if retired, rErr := repository.GetRetiredRefreshMeta(rawToken); rErr == nil && retired != nil {
			// An already-rotated token was presented: this is a token reuse attack.
			// Revoke all refresh tokens for that user immediately.
			_ = repository.DeleteAllUserSessions(retired.UserID)
			_ = repository.DeleteAllUserRefreshTokens(retired.UserID)
			clearRefreshCookie(c)
			utils.Unauthorized(c, "Token reuse detected. All sessions have been revoked. Please login again.")
			return
		}
		clearRefreshCookie(c)
		utils.Unauthorized(c, "Refresh token is invalid or has expired")
		return
	}

	// Enforce absolute expiry — the chain's maximum lifetime is fixed at login.
	if time.Now().Unix() > tokenData.AbsoluteExpiry {
		_ = repository.DeleteRefreshToken(rawToken)
		clearRefreshCookie(c)
		utils.Unauthorized(c, "Session has expired. Please login again.")
		return
	}

	// Fetch fresh user data (catches status or role changes since token was issued).
	var user models.User
	if err := repository.DB.First(&user, "id = ?", tokenData.UserID.String()).Error; err != nil {
		utils.Unauthorized(c, "User not found")
		return
	}

	if user.Status == "INACTIVE" {
		_ = repository.DeleteRefreshToken(rawToken)
		clearRefreshCookie(c)
		utils.Forbidden(c, "Your account has been deactivated.")
		return
	}

	// Issue new access token.
	accessToken, jti, err := utils.GenerateToken(uuid.UUID(user.ID), user.RoleID, user.RequiresPasswordChange, utils.AccessTokenTTL)
	if err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to generate new access token")
		return
	}
	if err := repository.StoreUserSession(uuid.UUID(user.ID), jti, utils.AccessTokenTTL); err != nil {
		c.Error(err)
	}

	// Compute remaining absolute TTL — cap at configured max, never extend the chain.
	remaining := time.Duration(tokenData.AbsoluteExpiry-time.Now().Unix()) * time.Second
	if remaining > utils.RefreshTokenTTL {
		remaining = utils.RefreshTokenTTL
	}

	// Atomically rotate: the transaction deletes the old token, records it in
	// retired_tokens for reuse detection, and inserts the new token — all or nothing.
	newRawToken := uuid.New().String()
	newData := repository.RefreshTokenData{
		UserID:         tokenData.UserID,
		FamilyID:       tokenData.FamilyID,
		AbsoluteExpiry: tokenData.AbsoluteExpiry,
	}

	_, rotated, err := repository.RotateRefreshToken(rawToken, newRawToken, newData, remaining)
	if err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to rotate refresh token")
		return
	}
	if !rotated {
		// Token disappeared between validation and rotation — a concurrent request already
		// rotated it. Check retired set to distinguish reuse attack from benign race.
		if retired, rErr := repository.GetRetiredRefreshMeta(rawToken); rErr == nil && retired != nil {
			_ = repository.DeleteAllUserSessions(retired.UserID)
			_ = repository.DeleteAllUserRefreshTokens(retired.UserID)
		}
		clearRefreshCookie(c)
		utils.Unauthorized(c, "Refresh token is invalid or has expired")
		return
	}

	setRefreshCookie(c, newRawToken, int(remaining.Seconds()))

	// Refresh token is delivered via cookie — do not include it in the body.
	utils.Success(c, gin.H{
		"access_token": accessToken,
	})
}

// Logout revokes all sessions for the user identified by the refresh token cookie.
// Reading from the cookie (not the access token) means this works even when the
// access token is expired.
// POST /api/v1/auth/logout
func Logout(c *gin.Context) {
	rawToken, cookieErr := c.Cookie(refreshCookieName)

	if cookieErr == nil && rawToken != "" {
		if tokenData, err := repository.GetRefreshTokenData(rawToken); err == nil && tokenData != nil {
			_ = repository.DeleteAllUserSessions(tokenData.UserID)
			_ = repository.DeleteAllUserRefreshTokens(tokenData.UserID)
		} else {
			// Cookie present but token already invalid — still delete the key to clean up.
			_ = repository.DeleteRefreshToken(rawToken)
		}
	}

	// Also remove the specific access token session when available in context
	// (present when the caller still has a valid access token).
	if userID, ok := c.Get("user_id"); ok {
		if jti, jtiOk := c.Get("jti"); jtiOk {
			uid, _ := uuid.Parse(fmt.Sprintf("%v", userID))
			if jtiStr, jOk := jti.(string); jOk && jtiStr != "" {
				_ = repository.DeleteUserSession(uid, jtiStr)
			}
		}
	}

	clearRefreshCookie(c)
	utils.SuccessMessage(c, "Logged out successfully. All sessions cleared.")
}
