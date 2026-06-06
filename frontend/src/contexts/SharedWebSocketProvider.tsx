'use client';

import { createContext, useCallback, useEffect, useRef, useContext } from 'react';
import { UseWebSocketOptions, useWebSocket } from '@/hooks/useWebSocket';
import { useAuthStore } from '@/store/useAuthStore';

export type SharedWebSocketContextValue = {
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  onScore: (listener: (data: { application_id: string; ats_score: number | null; reasoning: unknown }) => void) => () => void;
};

export const SharedWebSocketContext = createContext<SharedWebSocketContextValue | null>(null);

export function useSharedWebSocket(): SharedWebSocketContextValue {
  const ctx = useContext(SharedWebSocketContext);
  if (!ctx) {
    throw new Error('useSharedWebSocket must be used within SharedWebSocketProvider');
  }
  return ctx;
}

export function SharedWebSocketProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);

  const listenersRef = useRef(new Set<(data: { application_id: string; ats_score: number | null; reasoning: unknown }) => void>());

  const handleScore: UseWebSocketOptions['onScore'] = useCallback((data: { application_id: string; ats_score: number | null; reasoning: unknown }) => {
    listenersRef.current.forEach((listener) => listener(data));
  }, []);

  const ws = useWebSocket('/ws', { onScore: handleScore }, token ?? undefined);

  const onScore: SharedWebSocketContextValue['onScore'] = useCallback((listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    return () => {
      listenersRef.current.clear();
    };
  }, []);

  const value: SharedWebSocketContextValue = {
    connected: ws.connected,
    connect: ws.connect,
    disconnect: ws.disconnect,
    onScore,
  };

  return (
    <SharedWebSocketContext.Provider value={value}>
      {children}
    </SharedWebSocketContext.Provider>
  );
}
