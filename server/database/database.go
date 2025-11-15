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
	DB, err = gorm.Open(sqlite.Open(config.C.Database.SQLitePath), &gorm.Config{})
	if err != nil {
		panic("Failed to connect SQLite")
	}
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
