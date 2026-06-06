import api from './api';
import type { ChatAttachment, ChatResponse } from '@/types/chat';

export interface SendChatRequest {
  query: string;
  active_job_id?: string | null;
  user_profile_id?: string | null;
  job_description?: string;
  attachments?: ChatAttachment[];
}

export async function sendChatMessage(request: SendChatRequest): Promise<ChatResponse> {
  const { data } = await api.post<ChatResponse>('/chat', request);
  return data;
}

