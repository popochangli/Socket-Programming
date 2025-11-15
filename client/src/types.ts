export interface ChatMessage {
  id: number;
  room: string;
  author: string;
  author_id: string;
  recipient?: string;
  recipient_id?: string;
  content: string;
  is_private: boolean;
  created_at: string;
}

export interface Group {
  id: number;
  name: string;
  created_at: string;
}

export interface UserSummary {
  id: string;
  name: string;
}
