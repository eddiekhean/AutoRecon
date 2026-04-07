package handlers

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"autorecon-backend/internal/models"
	"autorecon-backend/internal/repository"
	"autorecon-backend/internal/utils"
)

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// LogoutRequest has an optional refresh_token.
// The access token JTI is always blacklisted; the refresh token is deleted only when provided.
type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// Login authenticates a user and returns both an access token and a refresh token.
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

	// When password change is forced, cap the access token to 15 minutes.
	// Refresh token is NOT issued in this case to prevent bypassing the reset flow.
	accessTTL := utils.AccessTokenTTL
	if user.RequiresPasswordChange {
		accessTTL = 15 * time.Minute
	}

	accessToken, jti, err := utils.GenerateToken(user.ID, user.RoleID, user.RequiresPasswordChange, accessTTL)
	if err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to generate access token")
		return
	}

	// Store access token session in Redis
	if err := repository.StoreUserSession(user.ID, jti, accessTTL); err != nil {
		c.Error(err)
	}

	// Build response payload
	responseData := gin.H{
		"access_token":             accessToken,
		"requires_password_change": user.RequiresPasswordChange,
	}

	// Only issue a refresh token if the account is fully active (not forced to change password)
	if !user.RequiresPasswordChange {
		refreshToken := uuid.New().String()
		if err := repository.StoreRefreshToken(refreshToken, user.ID, utils.RefreshTokenTTL); err != nil {
			c.Error(err)
			utils.InternalError(c, "Failed to store refresh token")
			return
		}
		responseData["refresh_token"] = refreshToken
	}

	utils.Success(c, responseData)
}

// RefreshToken issues a new access token when given a valid refresh token.
// POST /api/v1/auth/refresh
func RefreshToken(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "Invalid request format: "+err.Error())
		return
	}

	// Validate refresh token against Redis
	userID, err := repository.GetRefreshTokenOwner(req.RefreshToken)
	if err != nil || userID == "" {
		utils.Unauthorized(c, "Refresh token is invalid or has expired")
		return
	}

	// Fetch fresh user data from DB (catches status changes or role updates)
	var user models.User
	if err := repository.DB.First(&user, "id = ?", userID).Error; err != nil {
		utils.Unauthorized(c, "User not found")
		return
	}

	if user.Status == "INACTIVE" {
		// Invalidate the refresh token too
		repository.DeleteRefreshToken(req.RefreshToken)
		utils.Forbidden(c, "Your account has been deactivated.")
		return
	}

	// Issue a new access token
	accessToken, jti, err := utils.GenerateToken(user.ID, user.RoleID, user.RequiresPasswordChange, utils.AccessTokenTTL)
	if err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to generate new access token")
		return
	}

	// Store new access session in Redis
	if err := repository.StoreUserSession(user.ID, jti, utils.AccessTokenTTL); err != nil {
		c.Error(err)
	}

	// Rotate the refresh token (delete old, issue new) for better security
	repository.DeleteRefreshToken(req.RefreshToken)
	newRefreshToken := uuid.New().String()
	if err := repository.StoreRefreshToken(newRefreshToken, user.ID, utils.RefreshTokenTTL); err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to rotate refresh token")
		return
	}

	utils.Success(c, gin.H{
		"access_token":  accessToken,
		"refresh_token": newRefreshToken,
	})
}

// Logout invalidates the current access token and, if provided, its refresh token.
// The refresh_token field is optional — the access token JTI is always blacklisted.
// POST /api/v1/auth/logout
func Logout(c *gin.Context) {
	var req LogoutRequest
	// ShouldBindJSON only fails on malformed JSON, not on missing fields
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "Invalid request body: "+err.Error())
		return
	}

	// Always delete the current access token session (whitelist model: removing the key revokes it)
	userID, _ := c.Get("user_id")
	jti, _ := c.Get("jti")
	if userIDStr, ok1 := userID.(string); ok1 {
		if jtiStr, ok2 := jti.(string); ok2 && jtiStr != "" {
			if err := repository.DeleteUserSession(userIDStr, jtiStr); err != nil {
				c.Error(err)
			}
		}
	}

	// Delete the refresh token only when it was supplied
	if req.RefreshToken != "" {
		if err := repository.DeleteRefreshToken(req.RefreshToken); err != nil {
			c.Error(err)
		}
	}

	utils.SuccessMessage(c, "Logged out successfully. All sessions cleared.")
}
