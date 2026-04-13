package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"autorecon-backend/internal/repository"
	"autorecon-backend/internal/utils"
)

// AuthMiddleware validates the Bearer JWT token and optionally enforces a required role.
// Usage:
//
//	AuthMiddleware()     → only requires a valid token
//	AuthMiddleware(1)    → requires a valid token AND role_id == 1 (Admin)
func AuthMiddleware(requiredRoleID ...int) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			utils.Unauthorized(c, "Authorization header missing")
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			utils.Unauthorized(c, "Invalid token format. Expected: Bearer <token>")
			c.Abort()
			return
		}

		claims, err := utils.ValidateToken(parts[1])
		if err != nil || claims.Subject == "" {
			utils.Unauthorized(c, "Invalid or expired token")
			c.Abort()
			return
		}

		// Store claims in context for downstream handlers/middleware
		c.Set("user_id", claims.Subject)
		c.Set("role_id", claims.RoleID)
		c.Set("jti", claims.JTI)

		// WHITELIST CHECK: the session key access_token:{userID}:{JTI} must exist in Redis.
		// This covers ALL revocation paths: logout, password change, admin deactivation.
		// Fail-closed: Redis unavailable → 503 rather than silently admitting revoked tokens.
		uid, _ := uuid.Parse(claims.Subject)
		active, err := repository.IsSessionActive(uid, claims.JTI)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, utils.APIResponse{
				Status: "error",
				Error:  "Authentication service temporarily unavailable. Please try again.",
			})
			return
		}
		if !active {
			utils.Unauthorized(c, "Token has been revoked. Please login again.")
			c.Abort()
			return
		}

		// ENFORCE PASSWORD CHANGE: block all routes except PUT /users/me/password
		if claims.RequiresPasswordChange {
			if c.Request.Method == http.MethodPut && c.FullPath() == "/api/v1/users/me/password" {
				c.Next()
				return
			}
			c.AbortWithStatusJSON(http.StatusForbidden, utils.APIResponse{
				Status:  "error",
				Error:   "Password change required",
				Message: "You must change your default password before accessing other APIs",
			})
			return
		}

		// ROLE CHECK: if requiredRoleID is specified, enforce it
		if len(requiredRoleID) > 0 && claims.RoleID != requiredRoleID[0] {
			utils.Forbidden(c, "You do not have permission to access this resource")
			c.Abort()
			return
		}

		c.Next()
	}
}
