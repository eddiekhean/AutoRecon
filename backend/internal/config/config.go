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
	Host     string `mapstructure:"DB_HOST" validate:"required"`
	Port     string `mapstructure:"DB_PORT" validate:"required,numeric"`
	User     string `mapstructure:"DB_USER" validate:"required"`
	Password string `mapstructure:"DB_PASSWORD" validate:"required"`
	Name     string `mapstructure:"DB_NAME" validate:"required"`
}

type ServerConfig struct {
	Port      string `mapstructure:"PORT" validate:"required,numeric"`
	JWTSecret string `mapstructure:"JWT_SECRET" validate:"required"`
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
