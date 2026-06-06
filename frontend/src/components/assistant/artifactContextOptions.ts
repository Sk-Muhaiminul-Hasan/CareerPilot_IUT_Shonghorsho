import type { StoredArtifact } from '@/store/useArtifactStore';
import type { ContextOption } from './contextOptions';

export function artifactContextOptions(artifacts: StoredArtifact[]): ContextOption[] {
  return artifacts.slice(0, 4).map((artifact) => ({
    id: `artifact-${artifact.id}`,
    label: `Artifact: ${artifact.title}`,
    description: `Reuse this ${artifact.type.replace(/_/g, ' ')} as context.`,
    insertText: artifact.title,
    attachment: {
      type: 'artifact',
      label: artifact.title,
      value: artifact.content,
    },
  }));
}
