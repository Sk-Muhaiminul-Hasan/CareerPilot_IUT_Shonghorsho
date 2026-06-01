import { create } from 'zustand';

interface ChatStore {
  isOpen: boolean;
  activeJobId: string | null;
  userProfileId: string | null;
  toggleChat: () => void;
  openChatWithJob: (jobId: string) => void;
  closeChat: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  isOpen: false,
  activeJobId: null,
  userProfileId: 'default_user', // Fallback placeholder or wire into your auth state
  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  openChatWithJob: (jobId) => set({ isOpen: true, activeJobId: jobId }),
  closeChat: () => set({ isOpen: false, activeJobId: null }),
}));
