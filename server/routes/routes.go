package routes

import (
	"strings"

	"server/config"
	"server/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	socketio "github.com/googollee/go-socket.io"
)

func SetupRouter(srv *socketio.Server) *gin.Engine {
	r := gin.Default()

	corsCfg := cors.DefaultConfig()
	corsCfg.AllowCredentials = true
	corsCfg.AllowHeaders = []string{"Origin", "Content-Type"}
	corsCfg.AllowMethods = []string{"GET", "POST", "OPTIONS"}

	allowed := strings.TrimSpace(config.C.Socket.CORSAllowed)
	if allowed == "" || allowed == "*" {
		corsCfg.AllowAllOrigins = true
	} else {
		corsCfg.AllowOrigins = []string{}
		for _, origin := range strings.Split(allowed, ",") {
			origin = strings.TrimSpace(origin)
			if origin != "" {
				corsCfg.AllowOrigins = append(corsCfg.AllowOrigins, origin)
			}
		}
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
