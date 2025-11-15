package handlers

import (
	"net/http"
	"server/database"
	"server/models"

	"github.com/gin-gonic/gin"
)

func GetMessages(c *gin.Context) {
	room := c.Param("room")
	var msgs []models.Message
	database.DB.Where("room = ? AND is_private = ?", room, false).Order("created_at asc").Find(&msgs)
	c.JSON(http.StatusOK, msgs)
}

func GetPrivateMessages(c *gin.Context) {
	peer := c.Param("peer")
	me := c.Query("me")

	if peer == "" || me == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing peer or me"})
		return
	}

	var msgs []models.Message
	database.DB.
		Where("is_private = ? AND ((author_id = ? AND recipient_id = ?) OR (author_id = ? AND recipient_id = ?))",
			true, me, peer, peer, me).
		Order("created_at asc").
		Find(&msgs)

	c.JSON(http.StatusOK, msgs)
}
