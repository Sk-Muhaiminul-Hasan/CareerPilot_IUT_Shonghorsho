import { create } from 'zustand';

interface Notification {
  id: string;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
  autoHideDuration?: number | null;
}

interface AppStoreState {
  /** Whether the sidebar drawer is open (mobile). */
  sidebarOpen: boolean;
  /** Active notification for the global snackbar. */
  notification: Notification | null;
  /** Whether the backend WebSocket is connected. */
  wsConnected: boolean;
  /** The ID of the currently focused overall goal roadmap. */
  focusedGoalId: string | null;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  showNotification: (message: string, severity?: Notification['severity']) => void;
  clearNotification: () => void;
  setWsConnected: (connected: boolean) => void;
  setFocusedGoalId: (id: string | null) => void;
}

export const useAppStore = create<AppStoreState>((set) => ({
  sidebarOpen: false,
  notification: null,
  wsConnected: false,
  focusedGoalId: localStorage.getItem('focusedGoalId'),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  showNotification: (message: string, severity?: Notification['severity'], autoHideDuration?: number | null) =>
    set({
      notification: {
        id: crypto.randomUUID(),
        message,
        severity: severity ?? 'info',
        autoHideDuration: typeof autoHideDuration !== 'undefined' ? autoHideDuration : 5000,
      },
    }),

  clearNotification: () => set({ notification: null }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setFocusedGoalId: (id) => {
    if (id) {
      localStorage.setItem('focusedGoalId', id);
    } else {
      localStorage.removeItem('focusedGoalId');
    }
    set({ focusedGoalId: id });
  },
}));
