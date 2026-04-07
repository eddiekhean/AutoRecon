package utils

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// APIResponse is the single, fixed response structure for all API endpoints.
type APIResponse struct {
	Status  string      `json:"status"`            // "success" or "error"
	Message string      `json:"message,omitempty"` // Human-readable description
	Data    interface{} `json:"data,omitempty"`    // Payload returned on success
	Error   string      `json:"error,omitempty"`   // Error detail on failure
}

// Success sends a 200 OK response with data payload.
func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, APIResponse{
		Status: "success",
		Data:   data,
	})
}

// Created sends a 201 Created response with data payload.
func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, APIResponse{
		Status: "success",
		Data:   data,
	})
}

// SuccessMessage sends a 200 OK response with only a message (no data body).
func SuccessMessage(c *gin.Context, message string) {
	c.JSON(http.StatusOK, APIResponse{
		Status:  "success",
		Message: message,
	})
}

// Error sends a generic error response with the provided HTTP status code.
func Error(c *gin.Context, statusCode int, message string) {
	c.JSON(statusCode, APIResponse{
		Status: "error",
		Error:  message,
	})
}

// BadRequest sends a 400 Bad Request response.
func BadRequest(c *gin.Context, message string) {
	Error(c, http.StatusBadRequest, message)
}

// Unauthorized sends a 401 Unauthorized response.
func Unauthorized(c *gin.Context, message string) {
	Error(c, http.StatusUnauthorized, message)
}

// Forbidden sends a 403 Forbidden response.
func Forbidden(c *gin.Context, message string) {
	Error(c, http.StatusForbidden, message)
}

// NotFound sends a 404 Not Found response.
func NotFound(c *gin.Context, message string) {
	Error(c, http.StatusNotFound, message)
}

// InternalError sends a 500 Internal Server Error response.
func InternalError(c *gin.Context, message string) {
	Error(c, http.StatusInternalServerError, message)
}
