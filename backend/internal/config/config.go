package config

import (
	"log"

	"github.com/go-playground/validator/v10"
	"github.com/spf13/viper"
)

type AppConfig struct {
	Database DatabaseConfig `mapstructure:",squash"`
	Redis    RedisConfig    `mapstructure:",squash"`
	Server   ServerConfig   `mapstructure:",squash"`
}

type DatabaseConfig struct {
	Host     string `mapstructure:"DB_HOST" validate:"required"`
	Port     string `mapstructure:"DB_PORT" validate:"required,numeric"`
	User     string `mapstructure:"DB_USER" validate:"required"`
	Password string `mapstructure:"DB_PASSWORD" validate:"required"`
	Name     string `mapstructure:"DB_NAME" validate:"required"`
	SSLMode  string `mapstructure:"DB_SSL_MODE"` // "disable" for local dev; "require" / "verify-full" for prod
}

type RedisConfig struct {
	Host     string `mapstructure:"REDIS_HOST" validate:"required"`
	Port     string `mapstructure:"REDIS_PORT" validate:"required,numeric"`
	Password string `mapstructure:"REDIS_PASSWORD"`
	DB       int    `mapstructure:"REDIS_DB"`
}

type ServerConfig struct {
	Port                 string   `mapstructure:"PORT" validate:"required,numeric"`
	JWTPrivateKeyPath    string   `mapstructure:"JWT_PRIVATE_KEY_PATH" validate:"required"`
	JWTPublicKeyPath     string   `mapstructure:"JWT_PUBLIC_KEY_PATH" validate:"required"`
	AdminDefaultEmail    string   `mapstructure:"ADMIN_DEFAULT_EMAIL" validate:"required"`
	AdminDefaultPassword string   `mapstructure:"ADMIN_DEFAULT_PASSWORD" validate:"required"`
	AccessTokenTTL       string   `mapstructure:"ACCESS_TOKEN_TTL" validate:"required"`
	RefreshTokenTTL      string   `mapstructure:"REFRESH_TOKEN_TTL" validate:"required"`
	CORSAllowedOrigins   []string `mapstructure:"CORS_ALLOWED_ORIGINS"` // e.g. ["http://localhost:5173"]
}

func LoadConfig() *AppConfig {
	// Tells viper to look for a file named .env
	viper.SetConfigFile(".env")
	// If the file is not found, it's fine, we might be injecting from OS environment directly
	if err := viper.ReadInConfig(); err != nil {
		log.Println("Warning: Could not read .env file, relying on system environment variables:", err)
	}

	// Make sure viper automatically reads standard system environment variables if any
	viper.AutomaticEnv()

	// Safe defaults for optional fields (won't override values already set in .env / env vars)
	viper.SetDefault("DB_SSL_MODE", "disable")
	viper.SetDefault("CORS_ALLOWED_ORIGINS", []string{"http://localhost:5173"})

	var cfg AppConfig
	if err := viper.Unmarshal(&cfg); err != nil {
		log.Fatalf("Unable to decode into struct: %v", err)
	}

	// Validate the struct to ensure all requirements are met
	validate := validator.New()
	if err := validate.Struct(&cfg); err != nil {
		log.Fatalf("Config validation failed: %v", err)
	}

	log.Println("Configuration loaded and validated successfully.")
	return &cfg
}
