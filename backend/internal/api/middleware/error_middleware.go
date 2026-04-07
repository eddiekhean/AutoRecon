package middleware

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"autorecon-backend/internal/utils"
)

// ErrorLogger is a global middleware that:
// 1. Recovers from panics and logs the stack trace.
// 2. After each request, logs any errors attached to the context via c.Error(err).
func ErrorLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Recover from panics to prevent server crash
		defer func() {
			if rec := recover(); rec != nil {
				errMsg := fmt.Sprintf("%v", rec)
				log.Printf("[PANIC] %s %s | err=%s", c.Request.Method, c.Request.URL.Path, errMsg)
				utils.Error(c, http.StatusInternalServerError, "An unexpected error occurred. Please try again later.")
				c.Abort()
			}
		}()

		start := time.Now()
		c.Next()
		latency := time.Since(start)

		// Log all errors that handlers registered via c.Error(err)
		if len(c.Errors) > 0 {
			userID, _ := c.Get("user_id")
			for _, ginErr := range c.Errors {
				log.Printf("[ERROR] %s %s | status=%d | latency=%s | user=%v | err=%s",
					c.Request.Method,
					c.Request.URL.Path,
					c.Writer.Status(),
					latency,
					userID,
					ginErr.Error(),
				)
			}
		}
	}
}
