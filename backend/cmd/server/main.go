package main

import (
	"log"
	"time"

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

	// 1. Load and validate configuration
	appConfig := config.LoadConfig()

	// 2. Initialize Database (schema + seed)
	repository.InitDB(appConfig)

	// 3. Initialize JWT keys (RSA asymmetric) + parse TTL config
	if err := utils.LoadKeys(appConfig.Server.JWTPrivateKeyPath, appConfig.Server.JWTPublicKeyPath); err != nil {
		log.Fatalf("Failed to load JWT keys: %v", err)
	}
	if err := utils.SetTokenTTL(appConfig.Server.AccessTokenTTL, appConfig.Server.RefreshTokenTTL); err != nil {
		log.Fatalf("Token TTL config error: %v", err)
	}
	log.Printf("Token TTL → Access: %s | Refresh: %s", utils.AccessTokenTTL, utils.RefreshTokenTTL)

	// 4. Start background token cleanup worker.
	// SQL Server has no key TTL, so expired rows are pruned on a schedule.
	// Batched deletes (TOP 1000) avoid full table locks.
	go func() {
		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			log.Println("Running expired token cleanup...")
			repository.CleanupExpiredTokens()
		}
	}()

	// 5. Initialize Gin router
	r := gin.New()

	// 6. Global middleware stack
	r.Use(gin.Logger())
	r.Use(middleware.ErrorLogger())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     appConfig.Server.CORSAllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Length", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	// 7. Routes
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
			// Logout reads the refresh token cookie — no access token required.
			// This lets users with an expired access token still log out.
			auth.POST("/logout", handlers.Logout)
		}

		// --- Protected Routes (valid JWT required) ---
		protected := v1.Group("/")
		protected.Use(middleware.AuthMiddleware())
		{
			users := protected.Group("/users")
			{
				users.GET("/me", handlers.GetProfile)
				users.PUT("/me/password", handlers.ChangePassword)
				users.DELETE("/me/sessions", handlers.RevokeAllSessions)
			}
		}

		// --- Admin-Only Routes (valid JWT + role_id == 1) ---
		admin := v1.Group("/admin")
		admin.Use(middleware.AuthMiddleware(1))
		{
			adminUsers := admin.Group("/users")
			{
				adminUsers.POST("", handlers.ProvisionUser)
				adminUsers.GET("", handlers.ListUsers)
				adminUsers.GET("/:id", handlers.GetUser)
				adminUsers.PATCH("/:id", handlers.UpdateUser)
				adminUsers.PUT("/:id/status", handlers.UpdateUserStatus)
				adminUsers.POST("/:id/reset-password", handlers.ResetUserPassword)
			}
		}
	}

	// 8. Start server
	if err := r.Run(":" + appConfig.Server.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
