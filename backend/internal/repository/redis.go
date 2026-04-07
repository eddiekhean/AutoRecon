package repository

import (
	"context"
	"fmt"
	"log"

	"github.com/redis/go-redis/v9"
	"autorecon-backend/internal/config"
)

var (
	RedisClient *redis.Client
	RedisCtx    = context.Background()
)

// InitRedis initializes the Redis client
func InitRedis(cfg config.RedisConfig) {
	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)
	
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	// Check connection
	_, err := client.Ping(RedisCtx).Result()
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	log.Println("Successfully connected to Redis.")
	RedisClient = client
}
