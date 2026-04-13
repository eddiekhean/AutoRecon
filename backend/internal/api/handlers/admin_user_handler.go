package handlers

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"net/mail"
	"time"

	"github.com/google/uuid"
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
	required := []string{upperLetters, lowerLetters, digits, symbols}
	for i, charset := range required {
		ch, err := pick(charset)
		if err != nil {
			return "", err
		}
		password[i] = ch
	}
	for i := 4; i < 12; i++ {
		ch, err := pick(allChars)
		if err != nil {
			return "", err
		}
		password[i] = ch
	}
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

// UpdateUserRequest supports partial updates — all fields are optional.
// At least one must be provided or the handler returns 400.
type UpdateUserRequest struct {
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	RoleID   int    `json:"role_id"`
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

	var existing models.User
	if err := repository.DB.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		utils.Error(c, 409, fmt.Sprintf("Email '%s' is already registered", req.Email))
		return
	}

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
		RequiresPasswordChange: true,
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
		"default_password": plainPassword,
	})
}

// ListUsers returns all users, with optional role and status filters.
// GET /api/v1/admin/users?role=SALE&status=INACTIVE
func ListUsers(c *gin.Context) {
	roleFilter := c.Query("role")
	statusFilter := c.Query("status")

	type UserResponse struct {
		UserID    uuid.UUID `json:"user_id"`
		FullName  string    `json:"full_name"`
		Email     string    `json:"email"`
		Role      string    `json:"role"`
		Status    string    `json:"status"`
		CreatedAt time.Time `json:"created_at"`
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

// GetUser returns the full profile of a specific user, including admin-visible fields.
// GET /api/v1/admin/users/:id
func GetUser(c *gin.Context) {
	targetUserID := c.Param("id")

	type UserDetailResponse struct {
		UserID                 uuid.UUID `json:"user_id"`
		FullName               string    `json:"full_name"`
		Email                  string    `json:"email"`
		Role                   string    `json:"role"`
		RoleID                 int       `json:"role_id"`
		Status                 string    `json:"status"`
		RequiresPasswordChange bool      `json:"requires_password_change"`
		CreatedAt              time.Time `json:"created_at"`
		UpdatedAt              time.Time `json:"updated_at"`
	}

	var detail UserDetailResponse
	err := repository.DB.Table("users").
		Select("users.id as user_id, users.full_name, users.email, roles.role_name as role, users.role_id, users.status, users.requires_password_change, users.created_at, users.updated_at").
		Joins("LEFT JOIN roles ON users.role_id = roles.id").
		Where("users.id = ?", targetUserID).
		Scan(&detail).Error

	if err != nil || detail.UserID == uuid.Nil {
		utils.NotFound(c, "User not found")
		return
	}

	utils.Success(c, detail)
}

// UpdateUser partially updates a user's profile (full_name, email, role_id).
// Status changes must go through PUT /admin/users/:id/status.
// PATCH /api/v1/admin/users/:id
func UpdateUser(c *gin.Context) {
	targetUserID := c.Param("id")
	callerID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(targetUserID)

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if req.FullName == "" && req.Email == "" && req.RoleID == 0 {
		utils.BadRequest(c, "At least one field (full_name, email, role_id) is required")
		return
	}

	// Validate email format when provided
	if req.Email != "" {
		if _, err := mail.ParseAddress(req.Email); err != nil {
			utils.BadRequest(c, "Invalid email address")
			return
		}
	}

	// Prevent admins from changing their own role to avoid accidental privilege change
	callerIDStr := fmt.Sprintf("%v", callerID)
	if callerIDStr == uid.String() && req.RoleID != 0 {
		utils.BadRequest(c, "You cannot change your own role")
		return
	}

	var user models.User
	if err := repository.DB.First(&user, "id = ?", uid.String()).Error; err != nil {
		utils.NotFound(c, "User not found")
		return
	}

	// Check email uniqueness before applying (skip if email is unchanged)
	if req.Email != "" && req.Email != user.Email {
		var clash models.User
		if err := repository.DB.Where("email = ? AND id != ?", req.Email, uid).First(&clash).Error; err == nil {
			utils.Error(c, 409, fmt.Sprintf("Email '%s' is already in use by another account", req.Email))
			return
		}
	}

	if req.FullName != "" {
		user.FullName = req.FullName
	}
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.RoleID != 0 {
		user.RoleID = req.RoleID
	}

	if err := repository.DB.Save(&user).Error; err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to update user")
		return
	}

	utils.SuccessMessage(c, "User updated successfully")
}

// UpdateUserStatus activates or deactivates an employee account.
// PUT /api/v1/admin/users/:id/status
func UpdateUserStatus(c *gin.Context) {
	targetUserID := c.Param("id")
	callerID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(targetUserID)

	callerIDStr := fmt.Sprintf("%v", callerID)
	if callerIDStr == uid.String() {
		utils.BadRequest(c, "You cannot change your own account status")
		return
	}

	var req UpdateUserStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	var user models.User
	if err := repository.DB.First(&user, "id = ?", uid.String()).Error; err != nil {
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

	if req.Status == "INACTIVE" {
		if err := repository.DeleteAllUserSessions(uid); err != nil {
			c.Error(err)
		}
		if err := repository.DeleteAllUserRefreshTokens(uid); err != nil {
			c.Error(err)
		}
		message = "User status updated to INACTIVE. All active sessions have been cleared."
	}

	utils.SuccessMessage(c, message)
}

// ResetUserPassword generates a new temporary password for the target user,
// forces a password-change on next login, and immediately revokes all active sessions.
// This mirrors the initial provisioning flow but for an existing account.
// POST /api/v1/admin/users/:id/reset-password
func ResetUserPassword(c *gin.Context) {
	targetUserID := c.Param("id")
	callerID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(targetUserID)
	callerIDStr := fmt.Sprintf("%v", callerID)

	// Admins must use PUT /users/me/password for their own accounts
	if callerIDStr == uid.String() {
		utils.BadRequest(c, "Use PUT /users/me/password to change your own password")
		return
	}

	var user models.User
	if err := repository.DB.First(&user, "id = ?", uid.String()).Error; err != nil {
		utils.NotFound(c, "User not found")
		return
	}

	plainPassword, err := generateSecurePassword()
	if err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to generate password")
		return
	}

	hashedPassword, err := utils.HashPassword(plainPassword)
	if err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to hash password")
		return
	}

	user.PasswordHash = hashedPassword
	user.RequiresPasswordChange = true

	if err := repository.DB.Save(&user).Error; err != nil {
		c.Error(err)
		utils.InternalError(c, "Failed to reset password")
		return
	}

	// Revoke all existing sessions so the user must re-login with the new temporary password
	if err := repository.DeleteAllUserSessions(uid); err != nil {
		c.Error(err)
	}
	if err := repository.DeleteAllUserRefreshTokens(uid); err != nil {
		c.Error(err)
	}

	utils.Success(c, gin.H{
		"user_id":          user.ID,
		"email":            user.Email,
		"default_password": plainPassword, // Returned ONCE — never stored in plain text
	})
}
