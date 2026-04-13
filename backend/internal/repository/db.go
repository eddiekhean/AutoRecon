package repository

import (
	_ "embed"
	"fmt"
	"log"

	"gorm.io/driver/sqlserver"
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

	encrypt := cfg.Encrypt
	if encrypt == "" {
		encrypt = "disable" // local-dev fallback; set DB_ENCRYPT=true in production
	}
	trustCert := cfg.TrustServerCertificate
	if trustCert == "" {
		trustCert = "true" // local-dev fallback; set DB_TRUST_SERVER_CERT=false in production
	}

	// SQL Server DSN format:
	// sqlserver://user:password@host:port?database=name&encrypt=disable&TrustServerCertificate=true
	// PostgreSQL equivalent: host=... user=... password=... dbname=... port=... sslmode=...
	dsn := fmt.Sprintf("sqlserver://%s:%s@%s:%s?database=%s&encrypt=%s&TrustServerCertificate=%s",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Name, encrypt, trustCert,
	)

	db, err := gorm.Open(sqlserver.Open(dsn), &gorm.Config{})
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

		// T-SQL has no boolean literals; the BIT column accepts 0 / 1.
		// PostgreSQL equivalent used: true
		insertQuery := `
			INSERT INTO users (email, password_hash, requires_password_change, role_id)
			VALUES (?, ?, 1, 1)
		`
		if err := DB.Exec(insertQuery, email, hashedPassword).Error; err != nil {
			log.Fatalf("Failed to insert Root Admin: %v", err)
		}
		
		log.Printf("Successfully seeded Root Admin: %s. Requires Password Change on Next Login.", email)
	}
}
