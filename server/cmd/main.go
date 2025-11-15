package main

import (
	"fmt"
	"log"

	"server/config"
	"server/database"
	"server/routes"
	"server/socket"
)

func main() {
	config.LoadConfig()

	database.Connect()
	database.RunMigrations()

	srv := socket.NewSocketServer()
	go srv.Serve()
	defer srv.Close()

	router := routes.SetupRouter(srv)

	addr := fmt.Sprintf(":%d", config.C.Server.Port)
	log.Printf("Server running on %s\n", addr)

	if err := router.Run(addr); err != nil {
		log.Fatal(err)
	}
}
