package models

import "time"

type User struct {
    ID        uint      `gorm:"primaryKey"`
    Name      string
    CreatedAt time.Time
}
