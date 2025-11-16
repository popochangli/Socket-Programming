package routes

import (
	"log"
	"strings"

	"server/config"
	"server/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	socketio "github.com/googollee/go-socket.io"
)

func SetupRouter(srv *socketio.Server) *gin.Engine {
	r := gin.Default()
	
	// Debug middleware to log origin
	r.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		log.Printf("Request Origin: %s, Path: %s", origin, c.Request.URL.Path)
		c.Next()
	})
	
	// Middleware to ensure UTF-8 encoding for all responses
	r.Use(func(c *gin.Context) {
		c.Header("Content-Type", "application/json; charset=utf-8")
		c.Next()
	})

	corsCfg := cors.DefaultConfig()
	corsCfg.AllowHeaders = []string{"Origin", "Content-Type", "Accept-Charset", "Authorization"}
	corsCfg.AllowMethods = []string{"GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"}

	allowed := strings.TrimSpace(config.C.Socket.CORSAllowed)
	log.Printf("CORS Allowed Origins: %s", allowed)
	
	if allowed == "" || allowed == "*" {
		corsCfg.AllowAllOrigins = true
		corsCfg.AllowCredentials = false
	} else {
		corsCfg.AllowCredentials = true
		corsCfg.AllowOrigins = []string{}
		for _, origin := range strings.Split(allowed, ",") {
			origin = strings.TrimSpace(origin)
			if origin != "" {
				corsCfg.AllowOrigins = append(corsCfg.AllowOrigins, origin)
			}
		}
		log.Printf("Configured CORS Origins: %v", corsCfg.AllowOrigins)
	}
	r.Use(cors.New(corsCfg))

	r.GET("/socket.io/*any", gin.WrapH(srv))
	r.POST("/socket.io/*any", gin.WrapH(srv))

    r.GET("/rooms/:room/messages", handlers.GetMessages)
    r.GET("/dm/:peer/messages", handlers.GetPrivateMessages)
    r.GET("/groups", handlers.ListGroups)
    r.POST("/groups", handlers.CreateGroup)

	return r
}
