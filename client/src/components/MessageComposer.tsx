import { useState, useRef, KeyboardEvent, useEffect } from "react";
import EmojiPicker from "./EmojiPicker";
import "./MessageComposer.css";

interface Props {
  onSend: (content: string) => void;
  onTyping?: () => void;
  placeholder?: string;
  initialValue?: string;
}

export default function MessageComposer({ 
  onSend, 
  onTyping, 
  placeholder = "Type a message...", 
  initialValue = "" 
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleSend = () => {
    if (value.trim()) {
      onSend(value);
      setValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (text: string) => {
    setValue(text);
    onTyping?.();
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setValue((prev) => prev + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="message-composer">
      <button className="composer-btn" title="Attach file" disabled>
        📎
      </button>
      <div className="composer-input-wrapper">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
        />
      </div>
      <button className="composer-btn" onClick={() => setShowEmoji(!showEmoji)} title="Add emoji">
        😀
      </button>
      <button
        className="composer-btn composer-btn--send"
        onClick={handleSend}
        disabled={!value.trim()}
        title="Send (Enter)"
      >
        ➤
      </button>
      {showEmoji && (
        <div className="composer-emoji-picker">
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            onClose={() => setShowEmoji(false)}
          />
        </div>
      )}
    </div>
  );
}

