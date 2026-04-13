package config

import (
	"log"

	"github.com/go-playground/validator/v10"
	"github.com/spf13/viper"
)

type AppConfig struct {
	Database DatabaseConfig `mapstructure:",squash"`
	Server   ServerConfig   `mapstructure:",squash"`
}

type DatabaseConfig struct {
	Host     string `mapstructure:"DB_HOST"     validate:"required"`
	Port     string `mapstructure:"DB_PORT"     validate:"required,numeric"`
	User     string `mapstructure:"DB_USER"     validate:"required"`
	Password string `mapstructure:"DB_PASSWORD" validate:"required"`
	Name     string `mapstructure:"DB_NAME"     validate:"required"`
	// SQL Server connection security options.
	// Encrypt: "disable" for local dev; "true" for production.
	Encrypt string `mapstructure:"DB_ENCRYPT"`
	// TrustServerCertificate: "true" accepts self-signed certs (local dev / Docker).
	// Set to "false" in production when using a CA-signed certificate.
	TrustServerCertificate string `mapstructure:"DB_TRUST_SERVER_CERT"`
}

type ServerConfig struct {
	Port                 string   `mapstructure:"PORT" validate:"required,numeric"`
	JWTPrivateKeyPath    string   `mapstructure:"JWT_PRIVATE_KEY_PATH" validate:"required"`
	JWTPublicKeyPath     string   `mapstructure:"JWT_PUBLIC_KEY_PATH" validate:"required"`
	AdminDefaultEmail    string   `mapstructure:"ADMIN_DEFAULT_EMAIL" validate:"required"`
	AdminDefaultPassword string   `mapstructure:"ADMIN_DEFAULT_PASSWORD" validate:"required"`
	AccessTokenTTL       string   `mapstructure:"ACCESS_TOKEN_TTL" validate:"required"`
	RefreshTokenTTL      string   `mapstructure:"REFRESH_TOKEN_TTL" validate:"required"`
	CORSAllowedOrigins   []string `mapstructure:"CORS_ALLOWED_ORIGINS"`
	RefreshTokenHMACKey  string   `mapstructure:"REFRESH_TOKEN_HMAC_KEY" validate:"required"`
}

func LoadConfig() *AppConfig {
	viper.SetConfigFile(".env")
	if err := viper.ReadInConfig(); err != nil {
		log.Println("Warning: Could not read .env file, relying on system environment variables:", err)
	}

	viper.AutomaticEnv()

	viper.SetDefault("DB_ENCRYPT", "disable")
	viper.SetDefault("DB_TRUST_SERVER_CERT", "true")
	viper.SetDefault("CORS_ALLOWED_ORIGINS", []string{"http://localhost:5173"})

	var cfg AppConfig
	if err := viper.Unmarshal(&cfg); err != nil {
		log.Fatalf("Unable to decode into struct: %v", err)
	}

	validate := validator.New()
	if err := validate.Struct(&cfg); err != nil {
		log.Fatalf("Config validation failed: %v", err)
	}

	log.Println("Configuration loaded and validated successfully.")
	return &cfg
}
