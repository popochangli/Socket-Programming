package handlers

import (
	"net/http"

	"server/database"
	"server/models"

	"github.com/gin-gonic/gin"
	socketio "github.com/googollee/go-socket.io"
)

type CreateGroupInput struct {
	Name string `json:"name"`
}

var socketServer *socketio.Server

func AttachSocketServer(srv *socketio.Server) {
	socketServer = srv
}

func broadcastGroupCreated(group models.Group) {
	if socketServer == nil {
		return
	}
	socketServer.BroadcastToNamespace("/", "group:created", group)
}

func CreateGroup(c *gin.Context) {
	var body CreateGroupInput

	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	group := models.Group{Name: body.Name}
	if err := database.DB.Create(&group).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "unable to create group"})
		return
	}

	go broadcastGroupCreated(group)
	c.JSON(http.StatusOK, group)
}

func ListGroups(c *gin.Context) {
	var groups []models.Group
	database.DB.Find(&groups)
	c.JSON(http.StatusOK, groups)
}
