package models

import (
	"time"
)

// User represents the users table in the database.
//
// GORM type tag changes for SQL Server:
//   type:uuid              → type:uniqueidentifier  (SQL Server native UUID column type)
//   default:gen_random_uuid() → default:newid()     (SQL Server UUID generator function)
type User struct {
	ID                     UUID      `gorm:"type:uniqueidentifier;default:newid();primaryKey"`
	FullName               string    `gorm:"not null;default:''"`
	Email                  string    `gorm:"unique;not null"`
	PasswordHash           string    `gorm:"not null"`
	RequiresPasswordChange bool      `gorm:"default:false"`
	Status                 string    `gorm:"default:'ACTIVE';not null"` // ACTIVE | INACTIVE
	RoleID                 int       `gorm:"not null"`
	CreatedAt              time.Time `gorm:"autoCreateTime"`
	UpdatedAt              time.Time `gorm:"autoUpdateTime"`
}
