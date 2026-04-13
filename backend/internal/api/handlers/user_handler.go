package handlers

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"autorecon-backend/internal/models"
	"autorecon-backend/internal/repository"
	"autorecon-backend/internal/utils"
)

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

// GetProfile returns the complete information of the currently authenticated user.
// GET /api/v1/users/me
func GetProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		utils.Unauthorized(c, "User not authenticated")
		return
	}

	type UserProfileResponse struct {
		UserID   models.UUID `json:"user_id"`
		Email    string      `json:"email"`
		FullName string `json:"full_name"`
		Role     string `json:"role"`
	}

	var profile UserProfileResponse
	query := repository.DB.Table("users").
		Select("users.id as user_id, users.email, users.full_name, roles.role_name as role").
		Joins("LEFT JOIN roles ON users.role_id = roles.id").
		Where("users.id = ?", userID)

	if err := query.Scan(&profile).Error; err != nil || uuid.UUID(profile.UserID) == uuid.Nil {
		utils.NotFound(c, "User not found")
		return
	}

	utils.Success(c, profile)
}

// ChangePassword updates the authenticated user's password and clears the forced-change flag.
func ChangePassword(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		utils.Unauthorized(c, "User not authenticated")
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "Invalid request format: "+err.Error())
		return
	}

	var user models.User
	uid, _ := uuid.Parse(fmt.Sprintf("%v", userID))
	if err := repository.DB.First(&user, "id = ?", uid.String()).Error; err != nil {
		utils.NotFound(c, "User not found")
		return
	}

	if !utils.CheckPasswordHash(req.OldPassword, user.PasswordHash) {
		utils.Unauthorized(c, "Incorrect current password")
		return
	}

	newHashed, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to process new password")
		return
	}

	user.PasswordHash = newHashed
	user.RequiresPasswordChange = false

	if err := repository.DB.Save(&user).Error; err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to update password")
		return
	}

	// Revoke all sessions and refresh tokens — password change must invalidate every active session
	if err := repository.DeleteAllUserSessions(uid); err != nil {
		c.Error(err)
	}
	if err := repository.DeleteAllUserRefreshTokens(uid); err != nil {
		c.Error(err)
	}

	utils.SuccessMessage(c, "Password changed successfully. All previous sessions have been logged out.")
}

// RevokeAllSessions terminates every active session for the authenticated user.
// This is the deliberate "log out everywhere" action — distinct from the automatic
// revocation that happens on password change or account deactivation.
// DELETE /api/v1/users/me/sessions
func RevokeAllSessions(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		utils.Unauthorized(c, "User not authenticated")
		return
	}
	uid, _ := uuid.Parse(fmt.Sprintf("%v", userID))

	if err := repository.DeleteAllUserSessions(uid); err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to revoke sessions")
		return
	}
	if err := repository.DeleteAllUserRefreshTokens(uid); err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to revoke refresh tokens")
		return
	}

	utils.SuccessMessage(c, "All sessions have been revoked. Please login again.")
}
