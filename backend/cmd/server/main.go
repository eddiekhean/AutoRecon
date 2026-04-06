package main

import (
	"log"

	"github.com/gin-gonic/gin"

	"autorecon-backend/internal/config"
	"autorecon-backend/internal/repository"
)

func main() {
	log.Println("Starting AutoRecon API Server...")

	// 1. Tải và Validate Cấu hình
	appConfig := config.LoadConfig()

	// 2. Khởi tạo Cơ sở dữ liệu và tự động chạy Schema Triggers
	repository.InitDB(appConfig.Database)

	// 3. Khởi tạo Router Gin
	r := gin.Default()

	// Health check endpoint
	r.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "UP",
			"message": "AutoRecon Backend is running",
		})
	})

	// Placeholder for other routes...

	// Start server on the configured port
	if err := r.Run(":" + appConfig.Server.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
