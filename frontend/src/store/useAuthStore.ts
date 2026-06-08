import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  email?: string;
}

interface AuthStoreState {
  user: User | null;
  token: string | null;
  hydrated: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  setSession: (token: string | null, user: User | null, hydrated?: boolean) => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  token: null,
  hydrated: false,

  login: (token, user) => set({ token, user }),

  logout: async () => {
    await supabase.auth.signOut();
    set({ token: null, user: null });
  },

  setSession: (token, user, hydrated) => set({ token, user, hydrated: hydrated ?? false }),
}));
