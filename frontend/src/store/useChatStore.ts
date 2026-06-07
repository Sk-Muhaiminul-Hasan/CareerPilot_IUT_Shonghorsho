import { create } from 'zustand';

interface ChatStore {
  isOpen: boolean;
  activeJobId: string | null;
  userProfileId: string | null;
  toggleChat: () => void;
  openChatWithJob: (jobId: string) => void;
  openChatWithResume: (resumeId: string) => void;
  setUserProfileId: (resumeId: string | null) => void;
  closeChat: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  isOpen: false,
  activeJobId: null,
  userProfileId: null,
  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  openChatWithJob: (jobId) => set({ isOpen: true, activeJobId: jobId }),
  openChatWithResume: (resumeId) => set({ isOpen: true, userProfileId: resumeId }),
  setUserProfileId: (resumeId) => set({ userProfileId: resumeId }),
  closeChat: () => set({ isOpen: false, activeJobId: null }),
}));
