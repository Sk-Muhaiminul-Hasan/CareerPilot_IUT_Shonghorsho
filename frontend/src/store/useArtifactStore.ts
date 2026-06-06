import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatArtifact } from '@/types/chat';

export interface StoredArtifact extends ChatArtifact {
  id: string;
  created_at: string;
}

interface ArtifactStore {
  artifacts: StoredArtifact[];
  addArtifacts: (items: ChatArtifact[]) => void;
  updateArtifact: (artifactId: string, content: string) => void;
  removeArtifact: (artifactId: string) => void;
  clearArtifacts: () => void;
}

export const useArtifactStore = create<ArtifactStore>()(
  persist(
    (set) => ({
      artifacts: [],
      addArtifacts: (items) => {
        if (items.length === 0) return;
        const stamp = Date.now();
        const created = new Date().toISOString();
        set((state) => ({
          artifacts: [
            ...items.map((item, index) => ({
              ...item,
              id: `${stamp}-${index}`,
              created_at: created,
            })),
            ...state.artifacts,
          ].slice(0, 30),
        }));
      },
      removeArtifact: (artifactId) =>
        set((state) => ({
          artifacts: state.artifacts.filter((artifact) => artifact.id !== artifactId),
        })),
      updateArtifact: (artifactId, content) =>
        set((state) => ({
          artifacts: state.artifacts.map((artifact) =>
            artifact.id === artifactId ? { ...artifact, content } : artifact,
          ),
        })),
      clearArtifacts: () => set({ artifacts: [] }),
    }),
    { name: 'careerpilot-artifacts' },
  ),
);
