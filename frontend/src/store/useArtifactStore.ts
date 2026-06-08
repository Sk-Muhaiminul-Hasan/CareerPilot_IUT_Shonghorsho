import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatArtifact } from '@/types/chat';

export interface StoredArtifact extends ChatArtifact {
  id: string;
  created_at: string;
}

interface ArtifactStore {
  artifacts: StoredArtifact[];
  activeArtifactId: string | null;
  addArtifacts: (items: ChatArtifact[]) => void;
  updateArtifact: (artifactId: string, content: string) => void;
  removeArtifact: (artifactId: string) => void;
  clearArtifacts: () => void;
  setActiveArtifactId: (id: string | null) => void;
}

export const useArtifactStore = create<ArtifactStore>()(
  persist(
    (set) => ({
      artifacts: [],
      activeArtifactId: null,
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
          ].slice(0, 50),
        }));
      },
      removeArtifact: (artifactId) =>
        set((state) => ({
          artifacts: state.artifacts.filter((artifact) => artifact.id !== artifactId),
          activeArtifactId: state.activeArtifactId === artifactId ? null : state.activeArtifactId,
        })),
      updateArtifact: (artifactId, content) =>
        set((state) => ({
          artifacts: state.artifacts.map((artifact) =>
            artifact.id === artifactId ? { ...artifact, content } : artifact,
          ),
        })),
      clearArtifacts: () => set({ artifacts: [], activeArtifactId: null }),
      setActiveArtifactId: (id) => set({ activeArtifactId: id }),
    }),
    { name: 'careerpilot-artifacts' },
  ),
);
