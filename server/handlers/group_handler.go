package handlers

import (
    "server/database"
    "server/models"
    "net/http"

    "github.com/gin-gonic/gin"
)

type CreateGroupInput struct {
    Name string `json:"name"`
}

func CreateGroup(c *gin.Context) {
    var body CreateGroupInput

    if err := c.BindJSON(&body); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
        return
    }

    group := models.Group{Name: body.Name}
    database.DB.Create(&group)

    c.JSON(http.StatusOK, group)
}

func ListGroups(c *gin.Context) {
    var groups []models.Group
    database.DB.Find(&groups)
    c.JSON(http.StatusOK, groups)
}
