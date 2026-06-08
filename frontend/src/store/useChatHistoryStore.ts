import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatSession, ChatSource, ChatUiMessage } from '@/types/chat';

interface CreateSessionInput {
  title?: string;
  activeJobId?: string | null;
  userProfileId?: string | null;
  messages?: ChatUiMessage[];
}

interface ChatHistoryStore {
  sessions: ChatSession[];
  activeSessionId: string | null;
  createSession: (input?: CreateSessionInput) => string;
  setActiveSession: (sessionId: string) => void;
  appendMessage: (sessionId: string, message: ChatUiMessage) => void;
  replaceMessages: (sessionId: string, messages: ChatUiMessage[]) => void;
  deleteSession: (sessionId: string) => void;
  clearSession: (sessionId: string) => void;
}

const MAX_SESSIONS = 16;
const MAX_MESSAGES = 80;
const DEFAULT_TITLE = 'New chat';

export function createChatMessage(
  sender: ChatUiMessage['sender'],
  text: string,
  sources?: ChatSource[],
  artifacts?: ChatUiMessage['artifacts'],
): ChatUiMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sender,
    text,
    sources,
    artifacts,
    createdAt: new Date().toISOString(),
  };
}

function createSessionId(): string {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function titleFromMessages(messages: ChatUiMessage[], fallback: string): string {
  const firstUserMessage = messages.find((message) => message.sender === 'user');
  if (!firstUserMessage) return fallback;
  const compact = firstUserMessage.text.replace(/\s+/g, ' ').trim();
  return compact.length > 48 ? `${compact.slice(0, 45)}...` : compact || fallback;
}

function sortAndTrim(sessions: ChatSession[]): ChatSession[] {
  return [...sessions]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, MAX_SESSIONS);
}

export const useChatHistoryStore = create<ChatHistoryStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      createSession: (input = {}) => {
        const createdAt = new Date().toISOString();
        const id = createSessionId();
        const messages = (input.messages || []).slice(-MAX_MESSAGES);
        const session: ChatSession = {
          id,
          title: input.title || titleFromMessages(messages, DEFAULT_TITLE),
          messages,
          createdAt,
          updatedAt: createdAt,
          context: {
            activeJobId: input.activeJobId ?? null,
            userProfileId: input.userProfileId ?? null,
          },
        };
        set((state) => ({
          sessions: sortAndTrim([session, ...state.sessions]),
          activeSessionId: id,
        }));
        return id;
      },
      setActiveSession: (sessionId) => {
        if (get().sessions.some((session) => session.id === sessionId)) {
          set({ activeSessionId: sessionId });
        }
      },
      appendMessage: (sessionId, message) =>
        set((state) => ({
          sessions: sortAndTrim(
            state.sessions.map((session) => {
              if (session.id !== sessionId) return session;
              const messages = [...session.messages, message].slice(-MAX_MESSAGES);
              const nextTitle =
                session.title === DEFAULT_TITLE ? titleFromMessages(messages, session.title) : session.title;
              return {
                ...session,
                title: nextTitle,
                messages,
                updatedAt: new Date().toISOString(),
              };
            }),
          ),
        })),
      replaceMessages: (sessionId, messages) =>
        set((state) => ({
          sessions: sortAndTrim(
            state.sessions.map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    messages: messages.slice(-MAX_MESSAGES),
                    title: titleFromMessages(messages, session.title),
                    updatedAt: new Date().toISOString(),
                  }
                : session,
            ),
          ),
        })),
      deleteSession: (sessionId) =>
        set((state) => {
          const sessions = state.sessions.filter((session) => session.id !== sessionId);
          return {
            sessions,
            activeSessionId:
              state.activeSessionId === sessionId ? sessions[0]?.id ?? null : state.activeSessionId,
          };
        }),
      clearSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, title: DEFAULT_TITLE, messages: [], updatedAt: new Date().toISOString() }
              : session,
          ),
        })),
    }),
    {
      name: 'careerpilot-chat-history-v1',
      version: 1,
    },
  ),
);
