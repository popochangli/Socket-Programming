import { useEffect, useRef } from "react";
import type { ChatMessage } from "../types";
import "./MessageList.css";

interface Props {
  messages: ChatMessage[];
  currentUserId?: string;
}

export default function MessageList({ messages, currentUserId }: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diff / 60000);
    const diffHours = Math.floor(diff / 3600000);
    const diffDays = Math.floor(diff / 86400000);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getUserColor = (userId: string) => {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#FFA07A",
      "#98D8C8",
      "#F7DC6F",
      "#BB8FCE",
      "#85C1E2",
    ];
    const hash = userId
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const isImageMessage = (content: string): boolean => {
    return content.startsWith("IMAGE:");
  };

  const getImageSrc = (content: string): string => {
    return content.replace("IMAGE:", "");
  };

  return (
    <div className="message-list">
      {messages.map((msg, index) => {
        const isOwn = msg.author_id === currentUserId;
        const showAvatar = true;
        const showTimestamp = showAvatar || index === messages.length - 1;
        const isImage = isImageMessage(msg.content);

        return (
          <div
            key={msg.id}
            className={`message ${isOwn ? "message--own" : ""} ${
              showAvatar ? "message--new-group" : ""
            }`}
          >
            {!isOwn && showAvatar && (
              <div
                className="message__avatar"
                style={{ backgroundColor: getUserColor(msg.author_id) }}
              >
                {msg.author.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="message__content">
              {!isOwn && showAvatar && (
                <div className="message__author">{msg.author}</div>
              )}
              <div className="message__bubble">
                {isImage ? (
                  <img
                    src={getImageSrc(msg.content)}
                    alt="Sent image"
                    className="message__image"
                  />
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
              {showTimestamp && (
                <time className="message__timestamp">
                  {formatTimestamp(msg.created_at)}
                </time>
              )}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
