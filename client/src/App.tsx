import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { createGroup, fetchGroups } from "./api/group";
import { fetchPrivateMessages } from "./api/messages";
import { createSocket } from "./api/socket";
import type { ChatMessage, Group, UserSummary } from "./types";

const API_BASE =
  import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_SOCKET_URL ?? "http://localhost:8080";
const DISPLAY_NAME_KEY = "chat-display-name";
const JOINED_ROOMS_KEY = "chat-joined-rooms";

type ViewMode = "group" | "private";

function App() {
  const [displayName, setDisplayName] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("general");
  const [joinedRooms, setJoinedRooms] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return ["general"];
    }
    const stored = window.localStorage.getItem(JOINED_ROOMS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const normalized = parsed.filter((room) => typeof room === "string" && room.trim().length);
          if (!normalized.includes("general")) {
            normalized.unshift("general");
          }
          return Array.from(new Set(normalized));
        }
      } catch {
        // ignore parse errors and fall back to default
      }
    }
    return ["general"];
  });
  const [groupMessages, setGroupMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [groupInput, setGroupInput] = useState("");
  const [status, setStatus] = useState("Not connected");
  const [connecting, setConnecting] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [mode, setMode] = useState<ViewMode>("group");
  const [activeUser, setActiveUser] = useState<UserSummary | null>(null);
  const [privateMessages, setPrivateMessages] = useState<Record<string, ChatMessage[]>>({});
  const [privateInput, setPrivateInput] = useState("");
  const [privateLoading, setPrivateLoading] = useState(false);
  const [me, setMe] = useState<UserSummary | null>(null);

  const socketRef = useRef<SocketIOClient.Socket | null>(null);
  const roomRef = useRef(selectedRoom);
  const meRef = useRef<UserSummary | null>(null);
  const joinedRoomsRef = useRef<string[]>(["general"]);

  useEffect(() => {
    joinedRoomsRef.current = joinedRooms;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(JOINED_ROOMS_KEY, JSON.stringify(joinedRooms));
    }
  }, [joinedRooms]);

  const loadHistory = useCallback(async (roomName: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(roomName)}/messages`);
      if (!res.ok) throw new Error();
      const data: ChatMessage[] = await res.json();
      setGroupMessages(data);
    } catch (err) {
      console.error(err);
      setStatus("Unable to load messages");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const data = await fetchGroups();
      data.sort((a, b) => a.name.localeCompare(b.name));
      setGroups(data);
    } catch (err) {
      console.error(err);
      setStatus("Unable to load groups");
    }
  }, []);

  const loadPrivateHistory = useCallback(async (target: UserSummary) => {
    if (!meRef.current) return;
    setPrivateLoading(true);
    try {
      const data = await fetchPrivateMessages(meRef.current.id, target.id);
      setPrivateMessages((prev) => ({ ...prev, [target.id]: data }));
    } catch (err) {
      console.error(err);
      setStatus("Unable to load private messages");
    } finally {
      setPrivateLoading(false);
    }
  }, []);

  const ensureSocket = () => {
    if (socketRef.current) {
      return socketRef.current;
    }

    const socket = createSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("Connected to server");
      const profile = meRef.current;
      if (profile) {
        joinedRoomsRef.current.forEach((room) => {
          socket.emit("join", { room, name: profile.name });
        });
      }
    });
    socket.on("disconnect", () => {
      setStatus("Disconnected");
    });
    socket.on("joined", (payload: { room: string; name: string; userId: string }) => {
      const profile = { id: payload.userId, name: payload.name };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DISPLAY_NAME_KEY, profile.name);
      }
      setDisplayName(profile.name);
      setMe(profile);
      setJoinedRooms((prev) => {
        if (prev.includes(payload.room)) {
          return prev;
        }
        return [...prev, payload.room];
      });
      setStatus(`Joined #${payload.room}`);
      if (payload.room === roomRef.current) {
        loadHistory(payload.room);
      }
    });
    socket.on("users", (list: UserSummary[]) => setUsers(list));
    socket.on("chat", (msg: ChatMessage) => {
      if (msg.room !== roomRef.current) return;
      setGroupMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    socket.on("group:created", (group: Group) => {
      setGroups((prev) => {
        if (prev.some((g) => g.id === group.id)) {
          return prev;
        }
        return [...prev, group].sort((a, b) => a.name.localeCompare(b.name));
      });
    });
    socket.on("private", (msg: ChatMessage) => {
      const currentUser = meRef.current;
      if (!currentUser) return;
      const partnerId = msg.author_id === currentUser.id ? msg.recipient_id ?? "" : msg.author_id;
      if (!partnerId) return;
      setPrivateMessages((prev) => {
        const existing = prev[partnerId] ?? [];
        if (existing.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [partnerId]: [...existing, msg] };
      });
    });
    socket.on("error", (payload: { message?: string }) => {
      setStatus(payload?.message ?? "Server error");
    });

    return socket;
  };

  useEffect(() => {
    roomRef.current = selectedRoom;
  }, [selectedRoom]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedName = window.localStorage.getItem(DISPLAY_NAME_KEY);
    if (savedName) {
      setDisplayName(savedName);
    }
  }, []);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useEffect(() => {
    loadGroups();
    loadHistory("general");

    return () => {
      socketRef.current?.disconnect();
    };
  }, [loadGroups, loadHistory]);

  useEffect(() => {
    if (mode === "private" && activeUser && me) {
      loadPrivateHistory(activeUser);
    }
  }, [mode, activeUser, me, loadPrivateHistory]);

  const handleConnect = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setStatus("Enter a display name");
      return;
    }
    setConnecting(true);
    try {
      const socket = ensureSocket();
      socket.emit("join", { room: selectedRoom, name: trimmed });
      setStatus(`Joining #${selectedRoom}...`);
    } finally {
      setConnecting(false);
    }
  };

  const handleSendMessage = () => {
    const socket = socketRef.current;
    const trimmed = messageInput.trim();

    if (!socket || !joinedRooms.includes(selectedRoom)) {
      setStatus("Join this room first");
      return;
    }

    if (!trimmed) return;

    socket.emit("chat", { room: selectedRoom, content: trimmed });
    setMessageInput("");
  };

  const handleSendPrivate = () => {
    const socket = socketRef.current;
    const trimmed = privateInput.trim();

    if (!socket || !activeUser || !me) {
      setStatus("Select a user to chat");
      return;
    }

    if (!trimmed) return;

    socket.emit("private", { to: activeUser.id, content: trimmed });
    setPrivateInput("");
  };

  const handleCreateGroup = async () => {
    const name = groupInput.trim();
    if (!name) return;

    try {
      const newGroup = await createGroup(name);
      setGroups((prev) => {
        if (prev.some((g) => g.id === newGroup.id)) {
          return prev;
        }
        return [...prev, newGroup].sort((a, b) => a.name.localeCompare(b.name));
      });
      setJoinedRooms((prev) => {
        if (prev.includes(newGroup.name)) {
          return prev;
        }
        return [...prev, newGroup.name];
      });
      setSelectedRoom(newGroup.name);
      roomRef.current = newGroup.name;
      setMode("group");
      handleJoinRoom(newGroup.name);
      setGroupInput("");
    } catch (err) {
      if (err instanceof Error) {
        setStatus(err.message);
      } else {
        setStatus("Unable to create group");
      }
    }
  };

  const handleJoinRoom = (roomName: string) => {
    if (joinedRooms.includes(roomName)) {
      return;
    }
    const trimmed = displayName.trim();
    if (!trimmed) {
      setStatus("Enter a display name");
      return;
    }
    const socket = ensureSocket();
    socket.emit("join", { room: roomName, name: trimmed });
    setStatus(`Joining #${roomName}...`);
  };

  const handleSelectRoom = (roomName: string) => {
    if (roomName === selectedRoom) {
      return;
    }
    setSelectedRoom(roomName);
    setMode("group");
    roomRef.current = roomName;
    if (joinedRooms.includes(roomName)) {
      loadHistory(roomName);
    } else {
      setGroupMessages([]);
      setStatus("Join this room to see messages");
    }
  };

  const handleSelectUser = (user: UserSummary) => {
    if (!me || user.id === me.id) return;
    setActiveUser(user);
    setMode("private");
    if (!privateMessages[user.id]) {
      loadPrivateHistory(user);
    }
  };

  const privateThread = activeUser ? privateMessages[activeUser.id] ?? [] : [];
  const hasJoinedSelected = joinedRooms.includes(selectedRoom);
  const visibleUsers = me ? users.filter((u) => u.id !== me.id) : users;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__header">
          <h2>Rooms</h2>
          <span className="sidebar__count">{groups.length}</span>
        </div>
        <ul className="room-list">
          {groups.map((group) => {
            const isGeneral = group.name === "general";
            const isJoined = joinedRooms.includes(group.name);
            return (
              <li key={group.id} className="room-list__item">
                <button
                  className={`room-list__room ${group.name === selectedRoom ? "active" : ""}`}
                  onClick={() => handleSelectRoom(group.name)}
                >
                  #{group.name}
                </button>
                {!isGeneral && (
                  isJoined ? (
                    <span className="room-list__badge">Joined</span>
                  ) : (
                    <button
                      type="button"
                      className="room-list__join"
                      onClick={() => handleJoinRoom(group.name)}
                    >
                      Join
                    </button>
                  )
                )}
              </li>
            );
          })}
        </ul>
        <div className="sidebar__create">
          <input
            placeholder="New room name"
            value={groupInput}
            onChange={(e) => setGroupInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
          />
          <button onClick={handleCreateGroup}>Create</button>
        </div>

        <div className="sidebar__section">
          <h3>Online</h3>
          <ul className="user-list">
            {visibleUsers.map((user) => (
              <li key={user.id}>
                <button
                  className={activeUser?.id === user.id ? "active" : ""}
                  onClick={() => handleSelectUser(user)}
                >
                  {user.name}
                </button>
              </li>
            ))}
            {visibleUsers.length === 0 && <li className="empty">No one is online.</li>}
          </ul>
        </div>
      </aside>

      <main className="chat-panel">
        <header className="chat-panel__header">
          <div>
            <label>
              Display name
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane Doe"
                disabled={!!me}
              />
            </label>
            <button onClick={handleConnect} disabled={connecting || !displayName.trim()}>
              {me ? "Reconnect" : "Join room"}
            </button>
            {me && (
              <p className="hint">You are signed in as {me.name}. Reload to change this name.</p>
            )}
          </div>
          <span className="status">{status}</span>
        </header>

        <div className="chat-panel__tabs">
          <button className={mode === "group" ? "active" : ""} onClick={() => setMode("group")}>
            Group Chat
          </button>
          <button
            className={mode === "private" ? "active" : ""}
            onClick={() => setMode("private")}
          >
            Private Messages
          </button>
        </div>

        {mode === "group" ? (
          <>
            <section className="chat-panel__messages">
              <header>
                <h3>#{selectedRoom}</h3>
                {loadingMessages && <span>Loading...</span>}
              </header>
              <div className="messages">
                {!hasJoinedSelected ? (
                  <p className="empty">Join this room to view its messages.</p>
                ) : groupMessages.length === 0 && !loadingMessages ? (
                  <p className="empty">No messages yet.</p>
                ) : (
                  groupMessages.map((msg) => (
                    <article key={msg.id} className="message">
                      <div className="message__meta">
                        <strong>{msg.author}</strong>
                        <time>{new Date(msg.created_at).toLocaleTimeString()}</time>
                      </div>
                      <p>{msg.content}</p>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="chat-panel__input">
              <input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Say something nice..."
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                disabled={!hasJoinedSelected}
              />
              <button onClick={handleSendMessage} disabled={!hasJoinedSelected}>
                Send
              </button>
            </section>
          </>
        ) : (
          <>
            <section className="chat-panel__messages">
              <header>
                <h3>
                  {activeUser ? `DM with ${activeUser.name}` : "Select a user to start a DM"}
                </h3>
                {privateLoading && <span>Loading...</span>}
              </header>
              <div className="messages">
                {(!activeUser || privateThread.length === 0) && !privateLoading ? (
                  <p className="empty">
                    {activeUser
                      ? "No private messages yet."
                      : "There are no private chats yet. Pick someone from the list to start one."}
                  </p>
                ) : (
                  privateThread.map((msg) => (
                    <article key={msg.id} className="message">
                      <div className="message__meta">
                        <strong>{msg.author}</strong>
                        <time>{new Date(msg.created_at).toLocaleTimeString()}</time>
                      </div>
                      <p>{msg.content}</p>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="chat-panel__input">
              <input
                value={privateInput}
                onChange={(e) => setPrivateInput(e.target.value)}
                placeholder={
                  activeUser ? `Message ${activeUser.name}` : "Select a user to start chatting"
                }
                onKeyDown={(e) => e.key === "Enter" && handleSendPrivate()}
                disabled={!activeUser}
              />
              <button onClick={handleSendPrivate} disabled={!activeUser}>
                Send
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
