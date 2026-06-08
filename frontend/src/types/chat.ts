export interface ChatAttachment {
  type: string;
  label: string;
  value: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatUiMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  createdAt: string;
  sources?: ChatSource[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatUiMessage[];
  createdAt: string;
  updatedAt: string;
  context: {
    activeJobId?: string | null;
    userProfileId?: string | null;
  };
}

export interface ChatSource {
  id: string;
  resume_id: string;
  resume_name: string;
  rank: number;
  score: number;
  text: string;
}

export interface ChatArtifact {
  type: string;
  title: string;
  content: string;
  format: string;
  filename?: string | null;
  description?: string | null;
  data: Record<string, unknown>;
}

export interface ChatResponse {
  answer: string;
  intent: string;
  sources: ChatSource[];
  artifacts: ChatArtifact[];
  metadata: Record<string, unknown>;
}

