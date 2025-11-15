import { useState, useEffect, useRef, KeyboardEvent } from "react";
import "./ConnectionModal.css";

interface ConnectionModalProps {
  onConnect: (name: string) => Promise<void>;
  connecting: boolean;
  error: string | null;
}

export default function ConnectionModal({ onConnect, connecting, error }: ConnectionModalProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus input on mount
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || connecting) return;
    await onConnect(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !connecting) {
      handleSubmit();
    }
  };

  return (
    <div className="connection-modal-overlay">
      <div className="connection-modal">
        <div className="connection-modal__header">
          <h2>Welcome to ChatApp</h2>
          <p>Enter your name to start chatting</p>
        </div>

        <div className="connection-modal__body">
          <div className="connection-modal__input-group">
            <label htmlFor="display-name">Display Name</label>
            <input
              id="display-name"
              ref={inputRef}
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={connecting}
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="connection-modal__error">
              <span className="error-icon">⚠️</span>
              <span className="error-message">{error}</span>
            </div>
          )}

          {connecting && (
            <div className="connection-modal__loading">
              <div className="loading-spinner"></div>
              <span>Connecting to server...</span>
            </div>
          )}
        </div>

        <div className="connection-modal__footer">
          <button
            className="connection-modal__button"
            onClick={handleSubmit}
            disabled={!name.trim() || connecting}
          >
            {connecting ? "Connecting..." : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}

