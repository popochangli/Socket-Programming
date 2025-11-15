# Socket Programming Project

Modern full-stack chat playground that combines a Go (Gin + Socket.IO) backend with a React + TypeScript client.  
The server persists rooms, users, and group/private messages in SQLite, while the client offers a split UI for room conversations and direct messages.

## Features

- 🔌 **Socket.IO realtime bridge** between Go and React (long‑polling compatible for Windows without CGO)
- 💾 **SQLite persistence** for rooms, users, and chat history
- 👥 **Online user presence** broadcast to all clients
- 💬 **Group chat** with room history REST endpoints
- 📩 **Private messaging tab** with per-user threads and history fetch
- 🛡️ Configurable CORS and environment overrides for local/dev deployments

## Project Structure

```
.
├── server/        # Go backend (Gin, Socket.IO, GORM + SQLite)
├── client/        # React + Vite front-end
└── README.md
```

## Prerequisites

- Go 1.23+
- Node.js 20+ (or latest LTS) and npm
- SQLite (bundled through `github.com/glebarez/sqlite`, no CGO needed)

## Getting Started

### 1. Install dependencies

```bash
# From project root
cd server && go mod download
cd ../client && npm install
```

### 2. Configure environment

`server/config/config.yaml` ships with sane defaults:

```yaml
server:
  port: 8080
database:
  sqlite_path: "chat.db"
socket:
  cors_allowed: "http://127.0.0.1:6000,http://127.0.0.1:6001"
```

Client-side overrides live in `client/.env` (ignored by git). For local dev:

```
VITE_SOCKET_URL=http://127.0.0.1:8080
VITE_DEV_PORT=6000
```

### 3. Run the backend

```bash
cd server
go run ./cmd
```

The server logs when it loads config, applies migrations, and binds to `:8080`.

### 4. Run the client

```bash
cd client
npm run dev
```

Open the URL printed by Vite (default `http://127.0.0.1:6000`).  
Enter a display name, join the `#general` room, and start chatting.  
Use the **Online** list to open the Private Messages tab for a DM thread.

## REST & Socket Highlights

| Route | Description |
| --- | --- |
| `GET /groups` / `POST /groups` | List/create rooms |
| `GET /rooms/:room/messages` | Group history (public messages) |
| `GET /dm/:peer/messages?me=<id>` | Private history for a pair of users |
| `GET /socket.io/*` `POST /socket.io/*` | Socket.IO transport endpoints |

Socket events (namespace `/`):

| Event | Payload | Notes |
| --- | --- | --- |
| `join` | `{ room, name }` | Registers display name & joins room |
| `chat` | `{ room, content }` | Broadcast to room, stored in DB |
| `private` | `{ to, content }` | Direct message; echoed to sender & recipient |
| `users` | `user[]` | Server push of online users |
| `joined` | `{ room, name, userId }` | Confirmation of login/join |

## Testing / Production Builds

```bash
# Backend
cd server && go build ./...

# Frontend
cd client && npm run build
```

Deployments can run the compiled Go binary and `npm run build` output (`client/dist`) behind any static host or proxy.

## Troubleshooting

- **Port conflicts or EACCES**: adjust `VITE_DEV_PORT` / `PORT` or run with elevated privileges.
- **CORS errors**: update `socket.cors_allowed` in `config.yaml` to include your frontend origin(s).
- **Stale SQLite file**: delete `server/chat.db` (ignored by git) to reset the database; migrations will recreate tables.

Happy hacking!
