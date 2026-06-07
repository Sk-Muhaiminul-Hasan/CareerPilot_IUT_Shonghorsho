import type { StoredArtifact } from '@/store/useArtifactStore';

const MIME_BY_FORMAT: Record<string, string> = {
  markdown: 'text/markdown;charset=utf-8',
  md: 'text/markdown;charset=utf-8',
  text: 'text/plain;charset=utf-8',
  txt: 'text/plain;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
  json: 'application/json;charset=utf-8',
};

export function artifactFormat(artifact: Pick<StoredArtifact, 'format'>): string {
  return artifact.format || 'markdown';
}

export function artifactFilename(artifact: StoredArtifact): string {
  if (artifact.filename) return artifact.filename;
  const extension = artifactFormat(artifact) === 'text' ? 'txt' : artifactFormat(artifact);
  const name = artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'artifact';
  return `${name}.${extension === 'markdown' ? 'md' : extension}`;
}

export function downloadArtifact(artifact: StoredArtifact) {
  const format = artifactFormat(artifact);
  const blob = new Blob([artifact.content], {
    type: MIME_BY_FORMAT[format] || 'text/plain;charset=utf-8',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = artifactFilename(artifact);
  link.click();
  URL.revokeObjectURL(link.href);
}
