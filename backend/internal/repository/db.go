package repository

import (
	_ "embed"
	"fmt"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"autorecon-backend/internal/config"
)

//go:embed schema/init.sql
var initSQL string

var DB *gorm.DB

// InitDB now accepts the validated DatabaseConfig struct using Dependency Injection.
func InitDB(cfg config.DatabaseConfig) {
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Ho_Chi_Minh",
		cfg.Host, cfg.User, cfg.Password, cfg.Name, cfg.Port,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	DB = db
	log.Println("Database connection established.")

	log.Println("Executing idempotent schema initialization...")
	if err := DB.Exec(initSQL).Error; err != nil {
		log.Fatalf("Failed to execute init.sql: %v", err)
	}

	log.Println("Schema initialized successfully.")
}
