package models

import "time"

type Message struct {
    ID          uint      `gorm:"primaryKey" json:"id"`
    Room        string    `json:"room"`
    Author      string    `json:"author"`
    AuthorID    string    `json:"author_id"`
    Recipient   string    `json:"recipient,omitempty"`
    RecipientID string    `json:"recipient_id,omitempty"`
    Content     string    `json:"content"`
    IsPrivate   bool      `json:"is_private"`
    CreatedAt   time.Time `json:"created_at"`
}
