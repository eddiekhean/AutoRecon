package models

import (
	"time"
)

// User represents the users table in the database.
type User struct {
	ID                     string    `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	FullName               string    `gorm:"not null;default:''"`
	Email                  string    `gorm:"unique;not null"`
	PasswordHash           string    `gorm:"not null"`
	RequiresPasswordChange bool      `gorm:"default:false"`
	Status                 string    `gorm:"default:'ACTIVE';not null"` // ACTIVE | INACTIVE
	RoleID                 int       `gorm:"not null"`
	CreatedAt              time.Time `gorm:"autoCreateTime"`
	UpdatedAt              time.Time `gorm:"autoUpdateTime"`
}
