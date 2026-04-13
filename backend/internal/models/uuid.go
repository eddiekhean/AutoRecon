package models

import (
	"database/sql/driver"
	"fmt"

	"github.com/google/uuid"
)

// UUID is a wrapper around github.com/google/uuid that correctly handles
// SQL Server's mixed-endian UNIQUEIDENTIFIER byte order during GORM scanning.
type UUID uuid.UUID

// Scan implements sql.Scanner.
func (u *UUID) Scan(value interface{}) error {
	if value == nil {
		*u = UUID(uuid.Nil)
		return nil
	}

	switch v := value.(type) {
	case []byte:
		if len(v) == 16 {
			// SQL Server UNIQUEIDENTIFIER is stored as little-endian for the first 3 groups.
			// Example: 3f2457a8-800d-491b-a989-3e811e8dbce5 -> a857243f-0d80-1b49-a989-3e811e8dbce5 (standard)
			parsed := uuid.UUID{}
			parsed[0], parsed[1], parsed[2], parsed[3] = v[3], v[2], v[1], v[0]
			parsed[4], parsed[5] = v[5], v[4]
			parsed[6], parsed[7] = v[7], v[6]
			copy(parsed[8:], v[8:])
			*u = UUID(parsed)
			return nil
		}
		parsed, err := uuid.ParseBytes(v)
		if err != nil {
			return err
		}
		*u = UUID(parsed)
		return nil
	case string:
		parsed, err := uuid.Parse(v)
		if err != nil {
			return err
		}
		*u = UUID(parsed)
		return nil
	default:
		return fmt.Errorf("failed to scan UUID from %T", value)
	}
}

// Value implements driver.Valuer.
func (u UUID) Value() (driver.Value, error) {
	if uuid.UUID(u) == uuid.Nil {
		// Instead of inserting NULL for primary keys, we can generate a new one
		// or just return nil to let DB default:newid() take over.
		return nil, nil
	}
	return uuid.UUID(u).String(), nil
}

// String implements fmt.Stringer and returns the canonical hex string.
func (u UUID) String() string {
	return uuid.UUID(u).String()
}

// MarshalText implements encoding.TextMarshaler.
func (u UUID) MarshalText() ([]byte, error) {
	return uuid.UUID(u).MarshalText()
}

// UnmarshalText implements encoding.TextUnmarshaler.
func (u *UUID) UnmarshalText(data []byte) error {
	var uid uuid.UUID
	if err := uid.UnmarshalText(data); err != nil {
		return err
	}
	*u = UUID(uid)
	return nil
}


