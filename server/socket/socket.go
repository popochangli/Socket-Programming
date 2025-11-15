package socket

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"

	"server/database"
	"server/models"

	socketio "github.com/googollee/go-socket.io"
	"github.com/googollee/go-socket.io/engineio"
	"github.com/googollee/go-socket.io/engineio/transport"
	"github.com/googollee/go-socket.io/engineio/transport/polling"
	"github.com/googollee/go-socket.io/engineio/transport/websocket"
)

type joinPayload struct {
	Room string `json:"room"`
	Name string `json:"name"`
}

type privatePayload struct {
	To      string `json:"to"`
	Content string `json:"content"`
}

type chatPayload struct {
	Room    string `json:"room"`
	Content string `json:"content"`
}

type userInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

var (
	usersMu      sync.RWMutex
	usersByID    = map[string]userInfo{}
	roomsMu      sync.RWMutex
	roomsByID    = map[string]map[string]bool{} // socket ID -> room name -> true
)

func registerUser(id, name string) (userInfo, error) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return userInfo{}, fmt.Errorf("display name required")
	}

	usersMu.Lock()
	defer usersMu.Unlock()

	for _, u := range usersByID {
		if strings.EqualFold(u.Name, trimmed) {
			return userInfo{}, fmt.Errorf("name already in use")
		}
	}

	info := userInfo{ID: id, Name: trimmed}
	usersByID[id] = info
	return info, nil
}

func removeUser(id string) {
	usersMu.Lock()
	delete(usersByID, id)
	usersMu.Unlock()
	
	roomsMu.Lock()
	delete(roomsByID, id)
	roomsMu.Unlock()
}

func addRoomForUser(socketID, room string) {
	roomsMu.Lock()
	defer roomsMu.Unlock()
	if roomsByID[socketID] == nil {
		roomsByID[socketID] = make(map[string]bool)
	}
	roomsByID[socketID][room] = true
}

func removeRoomForUser(socketID, room string) {
	roomsMu.Lock()
	defer roomsMu.Unlock()
	if roomsByID[socketID] != nil {
		delete(roomsByID[socketID], room)
	}
}

func getRoomsForUser(socketID string) []string {
	roomsMu.RLock()
	defer roomsMu.RUnlock()
	rooms := roomsByID[socketID]
	if rooms == nil {
		return []string{}
	}
	result := make([]string, 0, len(rooms))
	for room := range rooms {
		result = append(result, room)
	}
	return result
}

func getUser(id string) (userInfo, bool) {
	usersMu.RLock()
	defer usersMu.RUnlock()
	info, ok := usersByID[id]
	return info, ok
}

func listUsers() []userInfo {
	usersMu.RLock()
	defer usersMu.RUnlock()
	out := make([]userInfo, 0, len(usersByID))
	for _, u := range usersByID {
		out = append(out, u)
	}
	return out
}

func broadcastUsers(srv *socketio.Server) {
	users := listUsers()
	srv.BroadcastToNamespace("/", "users", users)
}

func NewSocketServer() *socketio.Server {
	// Configure polling transport 
	pollTransport := &polling.Transport{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
	
	// Configure websocket transport
	wsTransport := &websocket.Transport{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
	
	opts := &engineio.Options{
		Transports: []transport.Transport{
			pollTransport,
			wsTransport,
		},
	}

	srv := socketio.NewServer(opts)

	srv.OnConnect("/", func(s socketio.Conn) error {
		s.Join(s.ID())
		// Initialize empty rooms map for this socket
		roomsMu.Lock()
		roomsByID[s.ID()] = make(map[string]bool)
		roomsMu.Unlock()
		log.Println("socket connected:", s.ID())
		return nil
	})

	srv.OnEvent("/", "join", func(s socketio.Conn, payload joinPayload) {
		room := strings.TrimSpace(payload.Room)
		if room == "" {
			room = "general"
		}

		info, ok := getUser(s.ID())
		if !ok {
			newUser, err := registerUser(s.ID(), payload.Name)
			if err != nil {
				s.Emit("error", map[string]string{"message": err.Error()})
				return
			}
			info = newUser
			broadcastUsers(srv)
		}

		s.Join(room)
		addRoomForUser(s.ID(), room)

		log.Printf("socket %s joined room %s", s.ID(), room)
		s.Emit("joined", map[string]string{
			"room":   room,
			"name":   info.Name,
			"userId": info.ID,
		})
		s.Emit("users", listUsers())
		
		var groups []models.Group
		if err := database.DB.Find(&groups).Error; err == nil {
			s.Emit("groups", groups)
		}
		
		// Send the user's current joined rooms list
		// Filter out the socket ID room (used for private messages)
		allRooms := getRoomsForUser(s.ID())
		joinedRooms := make([]string, 0)
		for _, r := range allRooms {
			if r != s.ID() {
				joinedRooms = append(joinedRooms, r)
			}
		}
		s.Emit("joined:rooms", joinedRooms)
	})

	srv.OnEvent("/", "chat", func(s socketio.Conn, payload chatPayload) {
		info, ok := getUser(s.ID())
		if !ok {
			s.Emit("error", map[string]string{"message": "join a room first"})
			return
		}

		room := strings.TrimSpace(payload.Room)
		if room == "" {
			room = "general"
		}

		content := strings.TrimSpace(payload.Content)
		if content == "" {
			return
		}

		msg := models.Message{
			Room:      room,
			Author:    info.Name,
			AuthorID:  info.ID,
			Content:   content,
			IsPrivate: false,
		}

		if err := database.DB.Create(&msg).Error; err != nil {
			log.Printf("failed to persist message: %v", err)
			s.Emit("error", map[string]string{"message": "unable to save message"})
			return
		}

		srv.BroadcastToRoom("/", msg.Room, "chat", msg)
	})

	srv.OnEvent("/", "private", func(s socketio.Conn, payload privatePayload) {
		info, ok := getUser(s.ID())
		if !ok {
			s.Emit("error", map[string]string{"message": "join first"})
			return
		}

		targetID := strings.TrimSpace(payload.To)
		if targetID == "" {
			s.Emit("error", map[string]string{"message": "missing recipient"})
			return
		}

		target, exists := getUser(targetID)
		if !exists {
			s.Emit("error", map[string]string{"message": "user offline"})
			return
		}

		content := strings.TrimSpace(payload.Content)
		if content == "" {
			return
		}

		room := fmt.Sprintf("dm:%s:%s", info.ID, target.ID)
		msg := models.Message{
			Room:        room,
			Author:      info.Name,
			AuthorID:    info.ID,
			Recipient:   target.Name,
			RecipientID: target.ID,
			Content:     content,
			IsPrivate:   true,
		}

		if err := database.DB.Create(&msg).Error; err != nil {
			log.Printf("failed to persist private message: %v", err)
			s.Emit("error", map[string]string{"message": "unable to save message"})
			return
		}

		// echo to sender
		s.Emit("private", msg)
		// send to recipient
		srv.BroadcastToRoom("/", target.ID, "private", msg)
	})

	srv.OnEvent("/", "leave", func(s socketio.Conn, room string) {
		room = strings.TrimSpace(room)
		if room == "" {
			return
		}
		s.Leave(room)
		removeRoomForUser(s.ID(), room)
		log.Printf("socket %s left room %s", s.ID(), room)
	})

	srv.OnDisconnect("/", func(s socketio.Conn, reason string) {
		log.Printf("socket disconnected %s: %s", s.ID(), reason)
		removeUser(s.ID())
		broadcastUsers(srv)
	})

	srv.OnError("/", func(s socketio.Conn, err error) {
		log.Printf("socket error %s: %v", s.ID(), err)
	})

	return srv
}
