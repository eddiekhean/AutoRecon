package repository

import (
	_ "embed"
	"fmt"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"autorecon-backend/internal/config"
	"autorecon-backend/internal/utils"
)

//go:embed schema/init.sql
var initSQL string

var DB *gorm.DB

// InitDB now accepts the validated AppConfig struct.
func InitDB(appCfg *config.AppConfig) {
	cfg := appCfg.Database
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

	checkAndSeedAdmin(appCfg.Server.AdminDefaultEmail, appCfg.Server.AdminDefaultPassword)
}

func checkAndSeedAdmin(email, defaultPassword string) {
	var count int64
	if err := DB.Table("users").Count(&count).Error; err != nil {
		log.Fatalf("Could not count users: %v", err)
	}

	if count == 0 {
		log.Println("No users found. System Bootstrapping: Seeding Root Admin...")
		
		// Note: We avoid importing utils directly if it causes circular dependency,
		// but repository -> utils is fine. Let's make sure hash_util exists.
		// However, doing raw SQL insert is safer for initial schema.
		
		// To avoid import cycle later if needed, we define it here, but we will use the utils package.
		
		hashedPassword, err := utils.HashPassword(defaultPassword)
		if err != nil {
			log.Fatalf("Failed to hash default password: %v", err)
		}

		insertQuery := `
			INSERT INTO users (email, password_hash, requires_password_change, role_id) 
			VALUES (?, ?, true, 1)
		`
		if err := DB.Exec(insertQuery, email, hashedPassword).Error; err != nil {
			log.Fatalf("Failed to insert Root Admin: %v", err)
		}
		
		log.Printf("Successfully seeded Root Admin: %s. Requires Password Change on Next Login.", email)
	}
}
