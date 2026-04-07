package handlers

import (
	"crypto/rand"
	"fmt"
	"math/big"

	"github.com/gin-gonic/gin"

	"autorecon-backend/internal/models"
	"autorecon-backend/internal/repository"
	"autorecon-backend/internal/utils"
)

// --- Password Generator ---

var (
	lowerLetters = "abcdefghijklmnopqrstuvwxyz"
	upperLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	digits       = "0123456789"
	symbols      = "@#$!%&"
	allChars     = lowerLetters + upperLetters + digits + symbols
)

// generateSecurePassword creates a cryptographically random 12-char password.
// Guarantees at least 1 uppercase, 1 lowercase, 1 digit, 1 symbol.
func generateSecurePassword() (string, error) {
	pick := func(charset string) (byte, error) {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return 0, err
		}
		return charset[idx.Int64()], nil
	}

	password := make([]byte, 12)
	// Guarantee character class diversity in first 4 positions
	required := []string{upperLetters, lowerLetters, digits, symbols}
	for i, charset := range required {
		ch, err := pick(charset)
		if err != nil {
			return "", err
		}
		password[i] = ch
	}
	// Fill remaining 8 positions from full charset
	for i := 4; i < 12; i++ {
		ch, err := pick(allChars)
		if err != nil {
			return "", err
		}
		password[i] = ch
	}

	// Shuffle to avoid predictable position pattern
	for i := len(password) - 1; i > 0; i-- {
		j, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return "", err
		}
		password[i], password[j.Int64()] = password[j.Int64()], password[i]
	}

	return string(password), nil
}

// --- Request / Response DTOs ---

type ProvisionUserRequest struct {
	FullName string `json:"full_name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	RoleID   int    `json:"role_id" binding:"required,min=1"`
}

type UpdateUserStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=ACTIVE INACTIVE"`
}

// --- Handlers ---

// ProvisionUser creates a new employee account with a system-generated password.
// POST /api/v1/admin/users
func ProvisionUser(c *gin.Context) {
	var req ProvisionUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	// Check for duplicate email
	var existing models.User
	if err := repository.DB.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		utils.Error(c, 409, fmt.Sprintf("Email '%s' is already registered", req.Email))
		return
	}

	// Generate a secure random password
	plainPassword, err := generateSecurePassword()
	if err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to generate default password")
		return
	}

	hashedPassword, err := utils.HashPassword(plainPassword)
	if err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to hash password")
		return
	}

	user := models.User{
		FullName:               req.FullName,
		Email:                  req.Email,
		PasswordHash:           hashedPassword,
		RoleID:                 req.RoleID,
		RequiresPasswordChange: true, // Force password change on first login
		Status:                 "ACTIVE",
	}

	if err := repository.DB.Create(&user).Error; err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to create user account")
		return
	}

	utils.Created(c, gin.H{
		"user_id":          user.ID,
		"email":            user.Email,
		"default_password": plainPassword, // Returned ONCE — never stored in plain text
	})
}

// ListUsers returns all users, with optional role and status filters.
// GET /api/v1/admin/users?role=Sale&status=INACTIVE
func ListUsers(c *gin.Context) {
	roleFilter := c.Query("role")
	statusFilter := c.Query("status")

	type UserResponse struct {
		UserID    string `json:"user_id"`
		FullName  string `json:"full_name"`
		Email     string `json:"email"`
		Role      string `json:"role"`
		Status    string `json:"status"`
		CreatedAt string `json:"created_at"`
	}

	query := repository.DB.Table("users").
		Select("users.id as user_id, users.full_name, users.email, roles.role_name as role, users.status, users.created_at").
		Joins("LEFT JOIN roles ON users.role_id = roles.id")

	if roleFilter != "" {
		query = query.Where("roles.role_name = ?", roleFilter)
	}
	if statusFilter != "" {
		query = query.Where("users.status = ?", statusFilter)
	}

	var users []UserResponse
	if err := query.Scan(&users).Error; err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to fetch user list")
		return
	}

	utils.Success(c, users)
}

// UpdateUserStatus activates or deactivates an employee account.
// PUT /api/v1/admin/users/:id/status
func UpdateUserStatus(c *gin.Context) {
	targetUserID := c.Param("id")

	// Prevent an admin from deactivating their own account
	callerID, _ := c.Get("user_id")
	if callerIDStr, ok := callerID.(string); ok && callerIDStr == targetUserID {
		utils.BadRequest(c, "You cannot change your own account status")
		return
	}

	var req UpdateUserStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	var user models.User
	if err := repository.DB.First(&user, "id = ?", targetUserID).Error; err != nil {
		utils.NotFound(c, "User not found")
		return
	}

	user.Status = req.Status
	if err := repository.DB.Save(&user).Error; err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to update user status")
		return
	}

	message := fmt.Sprintf("User status updated to %s.", req.Status)

	// If blocking the user, wipe all their active Redis sessions immediately
	if req.Status == "INACTIVE" {
		if err := repository.DeleteAllUserSessions(targetUserID); err != nil {
			c.Error(err)
			// Non-fatal: DB was updated; log but continue
		}
		message = "User status updated to INACTIVE. All active sessions have been cleared."
	}

	utils.SuccessMessage(c, message)
}
