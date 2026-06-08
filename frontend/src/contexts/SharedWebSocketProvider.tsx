'use client';

import { useCallback, useContext, createContext, useEffect, useRef } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { JobEnrichedMessage } from '@/types/websocket';
import { useAuthStore } from '@/store/useAuthStore';

export type SharedWebSocketContextValue = {
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  onScore: (listener: (data: { application_id: string; ats_score: number | null; reasoning: unknown }) => void) => () => void;
  onJobEnriched: (listener: (data: { job_id: string; title: string }) => void) => () => void;
};

export const SharedWebSocketContext = createContext<SharedWebSocketContextValue | null>(null);

export function useSharedWebSocket(): SharedWebSocketContextValue {
  const ctx = useContext(SharedWebSocketContext);
  if (!ctx) {
    throw new Error('useSharedWebSocket must be used within SharedWebSocketProvider');
  }
  return ctx;
}

type Listener<T> = (data: T) => void;

const scoreListeners = new Set<Listener<{ application_id: string; ats_score: number | null; reasoning: unknown }>>();
const jobEnrichedListeners = new Set<Listener<{ job_id: string; title: string }>>();

function notifyAll<T>(listeners: Set<Listener<T>>, value: T) {
  listeners.forEach((listener) => {
    try {
      listener(value);
    } catch (error) {
      console.error('SharedWebSocket listener failed', error);
    }
  });
}

export function SharedWebSocketProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);

  const handleScore = useCallback(
    (data: { application_id: string; ats_score: number | null; reasoning: unknown }) => {
      notifyAll(scoreListeners, data);
    },
    [],
  );

  const handleJobEnriched = useCallback(
    (data: { job_id: string; title: string }) => {
      notifyAll(jobEnrichedListeners, data);
    },
    [],
  );

  const ws = useWebSocket('/ws', { onScore: handleScore, onJobEnriched: handleJobEnriched }, token ?? undefined);

  const onScore = useCallback((listener: Listener<{ application_id: string; ats_score: number | null; reasoning: unknown }>) => {
    scoreListeners.add(listener);
    return () => {
      scoreListeners.delete(listener);
    };
  }, []);

  const onJobEnriched = useCallback((listener: Listener<{ job_id: string; title: string }>) => {
    jobEnrichedListeners.add(listener);
    return () => {
      jobEnrichedListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    return () => {
      scoreListeners.clear();
      jobEnrichedListeners.clear();
    };
  }, []);

  const value: SharedWebSocketContextValue = {
    connected: ws.connected,
    connect: ws.connect,
    disconnect: ws.disconnect,
    onScore,
    onJobEnriched,
  };

  return (
    <SharedWebSocketContext.Provider value={value}>
      {children}
    </SharedWebSocketContext.Provider>
  );
}
