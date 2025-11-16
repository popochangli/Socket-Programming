import type { RoomMember } from "../types";
import "./MemberList.css";

interface Props {
  members: RoomMember[];
  currentUserId?: string;
}

export default function MemberList({ members, currentUserId }: Props) {
  // Separate members by online status
  const onlineMembers = members.filter((m) => m.is_online);
  const offlineMembers = members.filter((m) => !m.is_online);

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

  const renderMember = (member: RoomMember) => {
    const isMe = member.id === currentUserId;
    return (
      <div
        key={member.id}
        className={`member-item ${isMe ? "member-item--me" : ""}`}
      >
        <div
          className="member-item__avatar"
          style={{ backgroundColor: getUserColor(member.id) }}
        >
          {member.name.charAt(0).toUpperCase()}
          <div
            className={`presence-indicator ${
              member.is_online ? "online" : "offline"
            }`}
          ></div>
        </div>
        <div className="member-item__content">
          <span className="member-item__name">
            {member.name}
            {isMe && " (You)"}
          </span>
          <span className="member-item__status">
            {member.is_online ? "🟢 Online" : "⚫ Offline"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="member-list">
      {onlineMembers.length > 0 && (
        <div className="member-list__section">
          <h4 className="member-list__section-title">
            🟢 Online ({onlineMembers.length})
          </h4>
          <div className="member-list__items">
            {onlineMembers.map(renderMember)}
          </div>
        </div>
      )}

      {offlineMembers.length > 0 && (
        <div className="member-list__section">
          <h4 className="member-list__section-title">
            ⚫ Offline ({offlineMembers.length})
          </h4>
          <div className="member-list__items">
            {offlineMembers.map(renderMember)}
          </div>
        </div>
      )}

      {members.length === 0 && (
        <div className="member-list__empty">
          <p>No members in this room</p>
        </div>
      )}
    </div>
  );
}

