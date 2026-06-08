import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AssistantMessage } from '@/components/assistant/AssistantMessages';
import type { ChatAttachment } from '@/types/chat';

const SIDEBAR_MIN = 280;
const SIDEBAR_MAX = 560;
const SIDEBAR_DEFAULT = 360;

interface ChatStore {
  // Panel open/close
  isOpen: boolean;
  // Sidebar width (px), persisted + user-resizable
  sidebarWidth: number;

  // Context
  activeJobId: string | null;
  userProfileId: string | null;

  // Conversation state — persisted so it survives route changes
  messages: AssistantMessage[];
  input: string;
  attachments: ChatAttachment[];
  jobDescription: string;
  showJobDescription: boolean;
  isTyping: boolean;
  greetingLoaded: boolean;

  // Actions
  toggleChat: () => void;
  openChatWithJob: (jobId: string) => void;
  openChatWithResume: (resumeId: string) => void;
  setUserProfileId: (resumeId: string | null) => void;
  closeChat: () => void;
  setSidebarWidth: (width: number) => void;

  setMessages: (messages: AssistantMessage[] | ((prev: AssistantMessage[]) => AssistantMessage[])) => void;
  setInput: (input: string) => void;
  setAttachments: (attachments: ChatAttachment[] | ((prev: ChatAttachment[]) => ChatAttachment[])) => void;
  setJobDescription: (description: string) => void;
  setShowJobDescription: (show: boolean) => void;
  setIsTyping: (isTyping: boolean) => void;
  setGreetingLoaded: (loaded: boolean) => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      isOpen: false,
      sidebarWidth: SIDEBAR_DEFAULT,
      activeJobId: null,
      userProfileId: null,

      messages: [{ sender: 'assistant', text: "Hey, I'm here." }],
      input: '',
      attachments: [],
      jobDescription: '',
      showJobDescription: false,
      isTyping: false,
      greetingLoaded: false,

      toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
      openChatWithJob: (jobId) => set({ isOpen: true, activeJobId: jobId }),
      openChatWithResume: (resumeId) => set({ isOpen: true, userProfileId: resumeId }),
      setUserProfileId: (resumeId) => set({ userProfileId: resumeId }),
      closeChat: () => set({ isOpen: false, activeJobId: null }),

      setSidebarWidth: (width) =>
        set({ sidebarWidth: Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width)) }),

      setMessages: (messages) =>
        set((state) => ({
          messages: typeof messages === 'function' ? messages(state.messages) : messages,
        })),
      setInput: (input) => set({ input }),
      setAttachments: (attachments) =>
        set((state) => ({
          attachments: typeof attachments === 'function' ? attachments(state.attachments) : attachments,
        })),
      setJobDescription: (description) => set({ jobDescription: description }),
      setShowJobDescription: (show) => set({ showJobDescription: show }),
      setIsTyping: (isTyping) => set({ isTyping }),
      setGreetingLoaded: (loaded) => set({ greetingLoaded: loaded }),
    }),
    {
      name: 'careerpilot-chat',
      // Only persist layout prefs + conversation; skip transient UI state
      partialize: (state) => ({
        isOpen: state.isOpen,
        sidebarWidth: state.sidebarWidth,
        messages: state.messages,
        input: state.input,
        attachments: state.attachments,
        jobDescription: state.jobDescription,
        greetingLoaded: state.greetingLoaded,
        userProfileId: state.userProfileId,
      }),
    },
  ),
);
