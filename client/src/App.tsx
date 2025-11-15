import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { createGroup, fetchGroups } from "./api/group";
import { fetchPrivateMessages } from "./api/messages";
import { createSocket } from "./api/socket";
import type { ChatMessage, Group, UserSummary } from "./types";
import MessageList from "./components/MessageList";
import MessageComposer from "./components/MessageComposer";
import ConnectionModal from "./components/ConnectionModal";

const API_BASE =
  import.meta.env.VITE_API_BASE ??
  import.meta.env.VITE_SOCKET_URL ??
  "http://localhost:8080";
const STORAGE = {
  DISPLAY_NAME: "chat-display-name",
  JOINED_ROOMS: "chat-joined-rooms",
  ROOM_DRAFTS: "chat-room-drafts",
  THEME: "chat-theme",
  SIDEBAR_COLLAPSED: "chat-sidebar-collapsed",
};

type ViewMode = "group" | "private";
type Theme = "light" | "dark";

function App() {
  // Core State
  const [displayName, setDisplayName] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("general");
  const [joinedRooms, setJoinedRooms] = useState<string[]>(() => {
    const stored = localStorage.getItem(STORAGE.JOINED_ROOMS);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && !parsed.includes("general")) {
          parsed.unshift("general");
        }
        return parsed;
      } catch {
        // ignore
      }
    }
    return ["general"];
  });

  const [groupMessages, setGroupMessages] = useState<ChatMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [roomDrafts, setRoomDrafts] = useState<Record<string, string>>(() => {
    const stored = localStorage.getItem(STORAGE.ROOM_DRAFTS);
    return stored ? JSON.parse(stored) : {};
  });

  // UI State
  const [mode, setMode] = useState<ViewMode>("group");
  const [activeUser, setActiveUser] = useState<UserSummary | null>(null);
  const [me, setMe] = useState<UserSummary | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [status, setStatus] = useState("Not connected");
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE.THEME);
    return (stored as Theme) || "dark";
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE.SIDEBAR_COLLAPSED) === "true";
  });
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [modalConnecting, setModalConnecting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const joinTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const modalConnectingRef = useRef(false);

  // Refs
  const socketRef = useRef<SocketIOClient.Socket | null>(null);
  const meRef = useRef<UserSummary | null>(null);
  const selectedRoomRef = useRef(selectedRoom);
  const modeRef = useRef(mode);
  const activeUserRef = useRef(activeUser);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const joinedRoomsRef = useRef<string[]>(joinedRooms);

  // Update refs
  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    activeUserRef.current = activeUser;
  }, [activeUser]);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useEffect(() => {
    joinedRoomsRef.current = joinedRooms;
  }, [joinedRooms]);

  useEffect(() => {
    modalConnectingRef.current = modalConnecting;
  }, [modalConnecting]);

  // Theme Effect
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE.THEME, theme);
  }, [theme]);

  // Persist joined rooms
  useEffect(() => {
    localStorage.setItem(STORAGE.JOINED_ROOMS, JSON.stringify(joinedRooms));
  }, [joinedRooms]);

  // Persist drafts
  useEffect(() => {
    localStorage.setItem(STORAGE.ROOM_DRAFTS, JSON.stringify(roomDrafts));
  }, [roomDrafts]);

  // Socket Connection
  const ensureSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;

    const socket = createSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      setStatus("Connected");
      setConnectionStatus("connected");
      const profile = meRef.current;
      if (profile) {
        // Rejoin all rooms on reconnect
        joinedRoomsRef.current.forEach((room) => {
          socket.emit("join", { room, name: profile.name });
        });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
      setStatus("Disconnected");
      setConnectionStatus("disconnected");
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Socket connect_error:", error);
      console.error("❌ Error message:", error.message);
      console.error("❌ Error type:", error.type);
      // Show error in modal if we're trying to connect
      if (modalConnectingRef.current) {
        const errorMsg = error.message || "Failed to connect to server";
        setModalError(
          errorMsg.includes("server error")
            ? "Server error occurred. Please check server logs and try again."
            : errorMsg
        );
        setModalConnecting(false);
        modalConnectingRef.current = false;
      }
    });

    socket.on(
      "joined",
      (payload: { room: string; name: string; userId: string }) => {
        console.log("✅ Joined room:", payload);
        const profile = { id: payload.userId, name: payload.name };
        setDisplayName(profile.name);
        setMe(profile);
        meRef.current = profile;
        localStorage.setItem(STORAGE.DISPLAY_NAME, profile.name);
        setJoinedRooms((prev) =>
          prev.includes(payload.room) ? prev : [...prev, payload.room]
        );
        setStatus(`Joined #${payload.room}`);
        setModalConnecting(false);
        setModalError(null);
        modalConnectingRef.current = false;

        // Clear join timeout
        if (joinTimeoutRef.current) {
          clearTimeout(joinTimeoutRef.current);
          joinTimeoutRef.current = null;
        }

        // Load history when joining
        if (payload.room === selectedRoomRef.current) {
          loadHistory(payload.room);
        }
      }
    );

    socket.on("users", (list: UserSummary[]) => {
      console.log("Users updated:", list);
      setUsers(list);
    });

    socket.on("chat", (msg: ChatMessage) => {
      setGroupMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Update unread count if not in the room
      if (msg.room !== selectedRoomRef.current || modeRef.current !== "group") {
        setUnreadCounts((prev) => ({
          ...prev,
          [msg.room]: (prev[msg.room] || 0) + 1,
        }));
      }
    });

    socket.on("private", (msg: ChatMessage) => {
      const currentUser = meRef.current;
      if (!currentUser) return;
      const partnerId =
        msg.author_id === currentUser.id
          ? msg.recipient_id ?? ""
          : msg.author_id;
      if (!partnerId) return;
      setPrivateMessages((prev) => {
        const existing = prev[partnerId] ?? [];
        if (existing.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [partnerId]: [...existing, msg] };
      });
      // Update unread count
      if (
        activeUserRef.current?.id !== partnerId ||
        modeRef.current !== "private"
      ) {
        setUnreadCounts((prev) => ({
          ...prev,
          [`dm:${partnerId}`]: (prev[`dm:${partnerId}`] || 0) + 1,
        }));
      }
    });

    socket.on("group:created", (group: Group) => {
      setGroups((prev) => {
        if (prev.some((g) => g.id === group.id)) return prev;
        return [...prev, group].sort((a, b) => a.name.localeCompare(b.name));
      });
    });

    socket.on("groups", (groupsList: Group[]) => {
      console.log("Groups received:", groupsList);
      setGroups((prev) => {
        // Deduplicate by name (name should be unique)
        const nameMap = new Map<string, Group>();
        // First, add existing groups
        prev.forEach((g) => {
          nameMap.set(g.name.toLowerCase(), g);
        });
        // Then, add new groups (will overwrite if same name)
        groupsList.forEach((g) => {
          nameMap.set(g.name.toLowerCase(), g);
        });
        return Array.from(nameMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      });
    });

    socket.on(
      "typing",
      ({
        room,
        userId,
        name,
      }: {
        room: string;
        userId: string;
        name: string;
      }) => {
        setTypingUsers((prev) => {
          const existing = prev[room] || [];
          if (existing.includes(name)) return prev;
          return { ...prev, [room]: [...existing, name] };
        });
        // Clear typing after 3 seconds
        setTimeout(() => {
          setTypingUsers((prev) => ({
            ...prev,
            [room]: (prev[room] || []).filter((n) => n !== name),
          }));
        }, 3000);
      }
    );

    socket.on("error", (payload: { message?: string }) => {
      console.error("Socket error:", payload);
      setStatus(payload?.message ?? "Server error");
      if (modalConnectingRef.current) {
        setModalError(payload?.message ?? "Server error occurred");
        setModalConnecting(false);
        modalConnectingRef.current = false;
      }
    });

    return socket;
  }, []); // Remove joinedRooms dependency

  const loadHistory = useCallback(async (roomName: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(
        `${API_BASE}/rooms/${encodeURIComponent(roomName)}/messages`
      );
      if (res.ok) {
        const data: ChatMessage[] = await res.json();
        setGroupMessages(data);
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    const savedName = localStorage.getItem(STORAGE.DISPLAY_NAME);
    if (savedName) setDisplayName(savedName);

    // Fetch groups as fallback (socket will send groups when user joins)
    fetchGroups()
      .then((data) => {
        setGroups((prev) => {
          // Deduplicate by name (name should be unique)
          const nameMap = new Map<string, Group>();
          // First, add existing groups
          prev.forEach((g) => {
            nameMap.set(g.name.toLowerCase(), g);
          });
          // Then, add new groups (will overwrite if same name)
          data.forEach((g) => {
            nameMap.set(g.name.toLowerCase(), g);
          });
          return Array.from(nameMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
          );
        });
      })
      .catch(console.error);

    loadHistory("general");

    return () => {
      socketRef.current?.disconnect();
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
      }
    };
  }, [loadHistory]);

  // Load messages when room/user changes
  useEffect(() => {
    if (mode === "group" && joinedRooms.includes(selectedRoom)) {
      loadHistory(selectedRoom);
      // Clear unread
      setUnreadCounts((prev) => ({ ...prev, [selectedRoom]: 0 }));
    }
  }, [selectedRoom, mode, joinedRooms, loadHistory]);

  useEffect(() => {
    if (mode === "private" && activeUser && me) {
      fetchPrivateMessages(me.id, activeUser.id)
        .then((data) =>
          setPrivateMessages((prev) => ({ ...prev, [activeUser.id]: data }))
        )
        .catch(console.error);
      // Clear unread
      setUnreadCounts((prev) => ({ ...prev, [`dm:${activeUser.id}`]: 0 }));
    }
  }, [activeUser, mode, me]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>(
          ".sidebar-search input"
        );
        input?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "1") {
        e.preventDefault();
        setMode("group");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "2") {
        e.preventDefault();
        setMode("private");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  // Handlers
  const handleModalConnect = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setModalError("Please enter a display name");
      return;
    }

    // Clear any existing timeout
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }

    setModalError(null);
    setModalConnecting(true);
    modalConnectingRef.current = true;

    try {
      const socket = ensureSocket();
      console.log("📤 Emitting join event:", {
        room: selectedRoom,
        name: trimmed,
      });
      console.log("📊 Socket connected status:", socket.connected);

      // Emit immediately - Socket.IO will queue if not connected
      socket.emit("join", { room: selectedRoom, name: trimmed });
      setStatus(`Joining #${selectedRoom}...`);

      // Add timeout fallback - if no "joined" event after 10 seconds, show error
      joinTimeoutRef.current = setTimeout(() => {
        if (!meRef.current) {
          console.warn("⚠️ Join timeout - no 'joined' event received");
          setModalError(
            "Connection timeout. Please check if the server is running and try again."
          );
          setModalConnecting(false);
        }
        joinTimeoutRef.current = null;
      }, 10000);
    } catch (err) {
      console.error("❌ Connection error:", err);
      setModalError("Failed to connect. Please try again.");
      setModalConnecting(false);
      modalConnectingRef.current = false;
    }
  };

  const handleConnect = () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setStatus("Enter a display name");
      return;
    }
    setConnectionStatus("connecting");
    const socket = ensureSocket();
    // Emit immediately - Socket.IO will queue if not connected
    socket.emit("join", { room: selectedRoom, name: trimmed });
    setStatus(`Joining #${selectedRoom}...`);
  };

  const handleSendMessage = (content: string) => {
    const socket = socketRef.current;
    if (!socket || !content.trim()) return;

    if (mode === "group") {
      if (!joinedRooms.includes(selectedRoom)) {
        setStatus("Join this room first");
        return;
      }
      socket.emit("chat", { room: selectedRoom, content: content.trim() });
      setRoomDrafts((prev) => ({ ...prev, [selectedRoom]: "" }));
    } else if (mode === "private" && activeUser) {
      socket.emit("private", { to: activeUser.id, content: content.trim() });
    }
  };

  const handleTyping = () => {
    const socket = socketRef.current;
    if (!socket || !me) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (mode === "group") {
      socket.emit("typing", {
        room: selectedRoom,
        userId: me.id,
        name: me.name,
      });
    }

    typingTimeoutRef.current = setTimeout(() => {
      // Optional: emit "stop typing" event
    }, 3000);
  };

  const handleSelectRoom = (roomName: string) => {
    setSelectedRoom(roomName);
    setMode("group");
    setUserPanelOpen(false);
  };

  const handleSelectUser = (user: UserSummary) => {
    if (!me || user.id === me.id) return;
    setActiveUser(user);
    setMode("private");
    setUserPanelOpen(true);
  };

  const handleJoinRoom = (roomName: string) => {
    if (joinedRooms.includes(roomName) || !me) return;
    const socket = ensureSocket();
    // Emit immediately - Socket.IO will queue if not connected
    socket.emit("join", { room: roomName, name: me.name });
  };

  const handleCreateGroup = async (name: string) => {
    try {
      const newGroup = await createGroup(name);
      // Don't add here - wait for socket event to avoid duplicates
      // Socket event will broadcast to all clients including this one
      handleJoinRoom(newGroup.name);
      setSelectedRoom(newGroup.name);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to create group");
    }
  };

  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

  const visibleUsers = me ? users.filter((u) => u.id !== me.id) : users;
  const currentMessages =
    mode === "group"
      ? groupMessages.filter((m) => m.room === selectedRoom)
      : activeUser
      ? privateMessages[activeUser.id] ?? []
      : [];
  const currentTyping = mode === "group" ? typingUsers[selectedRoom] || [] : [];

  return (
    <>
      {/* Connection Modal - Shows when not connected */}
      {!me && (
        <ConnectionModal
          onConnect={handleModalConnect}
          connecting={modalConnecting}
          error={modalError}
        />
      )}

      <div className={`app ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        {/* App Header */}
        <header className="app-header">
          <div className="app-header__left">
            <h1 className="app-logo">💬 ChatApp</h1>
          </div>
          <div className="app-header__right">
            <button
              className="icon-btn"
              onClick={toggleTheme}
              title="Toggle theme"
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            {me && (
              <div className="user-badge">
                <div className="avatar">{me.name.charAt(0).toUpperCase()}</div>
                <span>{me.name}</span>
              </div>
            )}
          </div>
        </header>

        <div className="app-body">
          {/* Sidebar */}
          <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
            <button
              className="sidebar-toggle"
              onClick={() => {
                setSidebarCollapsed(!sidebarCollapsed);
                localStorage.setItem(
                  STORAGE.SIDEBAR_COLLAPSED,
                  String(!sidebarCollapsed)
                );
              }}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? "→" : "←"}
            </button>

            {!sidebarCollapsed && (
              <>
                {/* Search */}
                <div className="sidebar-search">
                  <input
                    type="text"
                    placeholder="Search rooms, users... (⌘K)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Rooms Section */}
                <section className="sidebar-section">
                  <h3 className="sidebar-section__title">
                    <span>Rooms</span>
                    <button
                      onClick={() => {
                        const name = prompt("Enter room name:");
                        if (name) handleCreateGroup(name);
                      }}
                      title="Create new room"
                    >
                      +
                    </button>
                  </h3>
                  <ul className="sidebar-list">
                    {groups
                      .filter((g) =>
                        g.name.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((group) => {
                        const isSelected =
                          mode === "group" && selectedRoom === group.name;
                        const isJoined = joinedRooms.includes(group.name);
                        const unread = unreadCounts[group.name] || 0;

                        return (
                          <li
                            key={group.id}
                            className={`sidebar-item ${
                              isSelected ? "active" : ""
                            } ${!isJoined ? "not-joined" : ""}`}
                            onClick={() =>
                              isJoined && handleSelectRoom(group.name)
                            }
                          >
                            <div className="sidebar-item__icon">#</div>
                            <div className="sidebar-item__content">
                              <span className="sidebar-item__name">
                                {group.name}
                              </span>
                              {unread > 0 && (
                                <span className="sidebar-item__badge">
                                  {unread > 99 ? "99+" : unread}
                                </span>
                              )}
                            </div>
                            {!isJoined && (
                              <button
                                className="sidebar-item__action"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleJoinRoom(group.name);
                                }}
                              >
                                Join
                              </button>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                </section>

                {/* Direct Messages Section */}
                <section className="sidebar-section">
                  <h3 className="sidebar-section__title">
                    <span>Direct Messages</span>
                    <span className="online-count">
                      {visibleUsers.length} online
                    </span>
                  </h3>
                  <ul className="sidebar-list">
                    {visibleUsers
                      .filter((u) =>
                        u.name.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((user) => {
                        const isSelected =
                          mode === "private" && activeUser?.id === user.id;
                        const unread = unreadCounts[`dm:${user.id}`] || 0;

                        return (
                          <li
                            key={user.id}
                            className={`sidebar-item ${
                              isSelected ? "active" : ""
                            }`}
                            onClick={() => handleSelectUser(user)}
                          >
                            <div className="sidebar-item__icon avatar">
                              <div className="presence-indicator online"></div>
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="sidebar-item__content">
                              <span className="sidebar-item__name">
                                {user.name}
                              </span>
                              {unread > 0 && (
                                <span className="sidebar-item__badge">
                                  {unread > 99 ? "99+" : unread}
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    {visibleUsers.length === 0 && (
                      <li className="sidebar-empty">No users online</li>
                    )}
                  </ul>
                </section>
              </>
            )}
          </aside>

          {/* Main Chat Area */}
          <main className="chat-main">
            {/* Chat Header */}
            <header className="chat-header">
              <div className="chat-header__left">
                <div className="chat-header__icon">
                  {mode === "group"
                    ? "#"
                    : activeUser?.name.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="chat-header__info">
                  <h2 className="chat-header__title">
                    {mode === "group"
                      ? selectedRoom
                      : activeUser?.name || "Select a user"}
                  </h2>
                  <p className="chat-header__subtitle">
                    {mode === "group"
                      ? `${users.length} member${users.length !== 1 ? "s" : ""}`
                      : activeUser
                      ? "🟢 Active now"
                      : "Start a conversation"}
                  </p>
                </div>
              </div>
              <div className="chat-header__right">
                <button className="icon-btn" title="Search in conversation">
                  🔍
                </button>
                {mode === "private" && (
                  <button
                    className="icon-btn"
                    onClick={() => setUserPanelOpen(!userPanelOpen)}
                    title="Toggle user info"
                  >
                    {userPanelOpen ? "✕" : "ℹ️"}
                  </button>
                )}
              </div>
            </header>

            {/* Messages Area */}
            <div className="chat-messages">
              {!me ? (
                <div className="chat-empty">
                  <div className="chat-empty__icon">👋</div>
                  <h3>Welcome to ChatApp!</h3>
                  <p>Connect with your name to start chatting with others.</p>
                </div>
              ) : mode === "group" && !joinedRooms.includes(selectedRoom) ? (
                <div className="chat-empty">
                  <div className="chat-empty__icon">🚪</div>
                  <h3>Join #{selectedRoom}</h3>
                  <p>
                    Join this room to see messages and participate in the
                    conversation.
                  </p>
                  <button
                    className="btn-primary"
                    onClick={() => handleJoinRoom(selectedRoom)}
                  >
                    Join Room
                  </button>
                </div>
              ) : loadingMessages ? (
                <div className="chat-empty">
                  <div className="loading-spinner"></div>
                  <p>Loading messages...</p>
                </div>
              ) : currentMessages.length === 0 ? (
                <div className="chat-empty">
                  <div className="chat-empty__icon">💬</div>
                  <h3>No messages yet</h3>
                  <p>Be the first to say hello!</p>
                </div>
              ) : (
                <MessageList
                  messages={currentMessages}
                  currentUserId={me?.id}
                />
              )}

              {/* Typing Indicator */}
              {currentTyping.length > 0 && (
                <div className="typing-indicator">
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span>
                    {currentTyping.join(", ")}{" "}
                    {currentTyping.length === 1 ? "is" : "are"} typing...
                  </span>
                </div>
              )}
            </div>

            {/* Message Composer */}
            {me &&
              (mode === "group"
                ? joinedRooms.includes(selectedRoom)
                : activeUser) && (
                <div className="chat-composer">
                  <MessageComposer
                    onSend={handleSendMessage}
                    onTyping={handleTyping}
                    placeholder={
                      mode === "group"
                        ? `Message #${selectedRoom}`
                        : `Message ${activeUser?.name || ""}`
                    }
                    initialValue={
                      mode === "group" ? roomDrafts[selectedRoom] || "" : ""
                    }
                  />
                </div>
              )}

            {/* Connection Status */}
            <div className={`connection-status ${connectionStatus}`}>
              <span className="connection-dot"></span>
              {status}
            </div>
          </main>

          {/* User Info Panel (Right Sidebar) */}
          {userPanelOpen && activeUser && mode === "private" && (
            <aside className="user-panel">
              <button
                className="user-panel__close"
                onClick={() => setUserPanelOpen(false)}
              >
                ✕
              </button>
              <div className="user-panel__header">
                <div className="user-panel__avatar">
                  {activeUser.name.charAt(0).toUpperCase()}
                  <div className="presence-indicator online"></div>
                </div>
                <h3>{activeUser.name}</h3>
                <p className="status-text">🟢 Active now</p>
              </div>
              <div className="user-panel__section">
                <h4>About</h4>
                <p className="text-muted">No bio yet</p>
              </div>
              <div className="user-panel__section">
                <h4>Actions</h4>
                <button className="btn-secondary" disabled>
                  🔕 Mute Notifications
                </button>
                <button className="btn-secondary" disabled>
                  🚫 Block User
                </button>
              </div>
            </aside>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
