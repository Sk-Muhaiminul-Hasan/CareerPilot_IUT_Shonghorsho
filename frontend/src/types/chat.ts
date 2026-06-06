export interface ChatAttachment {
  type: string;
  label: string;
  value: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
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

