package models

import "time"

type RoomMember struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Room      string    `gorm:"index" json:"room"`
	UserID    string    `gorm:"index" json:"user_id"`
	UserName  string    `json:"user_name"`
	JoinedAt  time.Time `json:"joined_at"`
}

