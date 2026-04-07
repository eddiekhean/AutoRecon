package handlers

import (
	"github.com/gin-gonic/gin"

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
		UserID   string `json:"user_id"`
		Email    string `json:"email"`
		FullName string `json:"full_name"`
		Role     string `json:"role"`
	}

	var profile UserProfileResponse
	query := repository.DB.Table("users").
		Select("users.id as user_id, users.email, users.full_name, roles.role_name as role").
		Joins("LEFT JOIN roles ON users.role_id = roles.id").
		Where("users.id = ?", userID)

	if err := query.Scan(&profile).Error; err != nil || profile.UserID == "" {
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
	if err := repository.DB.First(&user, "id = ?", userID).Error; err != nil {
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

	// Delete all user sessions to force re-login
	userIDStr, _ := userID.(string)
	if err := repository.DeleteAllUserSessions(userIDStr); err != nil {
		c.Error(err)
	}

	utils.SuccessMessage(c, "Password changed successfully. All previous sessions have been logged out.")
}
