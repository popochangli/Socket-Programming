package database

import (
	"server/config"
	"server/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Connect() {
	var err error
	// Add charset=utf8 and proper encoding parameters to handle non-English characters
	dbPath := config.C.Database.SQLitePath + "?charset=utf8&parseTime=true"
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		panic("Failed to connect SQLite")
	}
	
	// Execute PRAGMA to ensure UTF-8 encoding
	DB.Exec("PRAGMA encoding = 'UTF-8'")
}

func RunMigrations() {
	if err := DB.AutoMigrate(&models.User{}, &models.Message{}, &models.Group{}); err != nil {
		panic("Failed to run migrations")
	}

	var count int64
	DB.Model(&models.Group{}).Where("name = ?", "general").Count(&count)
	if count == 0 {
		DB.Create(&models.Group{Name: "general"})
	}
}
