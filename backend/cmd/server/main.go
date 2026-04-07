package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"autorecon-backend/internal/api/handlers"
	"autorecon-backend/internal/api/middleware"
	"autorecon-backend/internal/config"
	"autorecon-backend/internal/repository"
	"autorecon-backend/internal/utils"
)

func main() {
	log.Println("Starting AutoRecon API Server...")

	// 1. Tải và Validate Cấu hình
	appConfig := config.LoadConfig()

	// 2. Khởi tạo Database (schema + seed) và Redis
	repository.InitDB(appConfig)
	repository.InitRedis(appConfig.Redis)

	// 3. Khởi tạo JWT Keys (RSA asymmetric) + parse TTL config
	if err := utils.LoadKeys(appConfig.Server.JWTPrivateKeyPath, appConfig.Server.JWTPublicKeyPath); err != nil {
		log.Fatalf("Failed to load JWT keys: %v", err)
	}
	if err := utils.SetTokenTTL(appConfig.Server.AccessTokenTTL, appConfig.Server.RefreshTokenTTL); err != nil {
		log.Fatalf("Token TTL config error: %v", err)
	}
	log.Printf("Token TTL → Access: %s | Refresh: %s", utils.AccessTokenTTL, utils.RefreshTokenTTL)

	// 4. Khởi tạo Router Gin
	r := gin.New() // Use gin.New() instead of Default() so we control middleware stack

	// 5. Global Middleware Stack
	r.Use(gin.Logger())                // Built-in request logger
	r.Use(middleware.ErrorLogger())    // Centralized error logger + panic recovery
	r.Use(cors.New(cors.Config{        // CORS policy
		AllowAllOrigins: true,
		AllowMethods:    []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:    []string{"Origin", "Content-Length", "Content-Type", "Authorization"},
	}))

	// 6. Routes
	v1 := r.Group("/api/v1")
	{
		// Health check (public)
		v1.GET("/health", func(c *gin.Context) {
			utils.Success(c, gin.H{"status": "UP", "message": "AutoRecon Backend is running"})
		})

		// --- Public Routes ---
		auth := v1.Group("/auth")
		{
			auth.POST("/login", handlers.Login)
			auth.POST("/refresh", handlers.RefreshToken)
		}

		// --- Protected Routes (valid JWT required) ---
		protected := v1.Group("/")
		protected.Use(middleware.AuthMiddleware())
		{
			users := protected.Group("/users")
			{
				users.PUT("/me/password", handlers.ChangePassword)
			}
			protected.POST("/auth/logout", handlers.Logout)
		}

		// --- Admin-Only Routes (valid JWT + role_id == 1) ---
		admin := v1.Group("/admin")
		admin.Use(middleware.AuthMiddleware(1))
		{
			adminUsers := admin.Group("/users")
			{
				adminUsers.POST("", handlers.ProvisionUser)
				adminUsers.GET("", handlers.ListUsers)
				adminUsers.PUT("/:id/status", handlers.UpdateUserStatus)
			}
		}
	}

	// 7. Start server
	if err := r.Run(":" + appConfig.Server.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
