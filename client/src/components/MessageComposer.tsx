import { useState, useRef, useEffect, type KeyboardEvent } from "react";
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
  initialValue = "",
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleSend = () => {
    const hasText = value.trim();
    const hasImage = selectedImage !== null;

    if (hasText || hasImage) {
      // ถ้ามีทั้งข้อความและรูปภาพ ให้ส่งรูปภาพก่อน (รูปจะแสดงก่อนข้อความ)
      if (hasImage) {
        onSend(`IMAGE:${selectedImage}`);
        setSelectedImage(null);
      }
      // ถ้ามีข้อความ ให้ส่งข้อความ
      if (hasText) {
        onSend(value);
        setValue("");
      }
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
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        150
      )}px`;
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setValue((prev) => prev + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ตรวจสอบว่าเป็นไฟล์รูปภาพ
    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }

    // จำกัดขนาดไฟล์ (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      // เก็บรูปภาพไว้ใน state แทนการส่งทันที
      setSelectedImage(base64String);
    };
    reader.onerror = () => {
      alert("เกิดข้อผิดพลาดในการอ่านไฟล์");
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
  };

  return (
    <div className="message-composer">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />
      <button
        className="composer-btn"
        title="Attach image"
        onClick={() => fileInputRef.current?.click()}
      >
        📎
      </button>
      <div className="composer-input-wrapper">
        {selectedImage && (
          <div className="composer-image-preview">
            <img src={selectedImage} alt="Preview" />
            <button
              className="composer-image-remove"
              onClick={handleRemoveImage}
              title="Remove image"
            >
              ✕
            </button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
        />
      </div>
      <button
        className="composer-btn"
        onClick={() => setShowEmoji(!showEmoji)}
        title="Add emoji"
      >
        😀
      </button>
      <button
        className="composer-btn composer-btn--send"
        onClick={handleSend}
        disabled={!value.trim() && !selectedImage}
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
