import React from 'react';
import {
  Box,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { StoredArtifact } from '@/store/useArtifactStore';
import { artifactFormat, downloadArtifact } from '@/utils/artifactFiles';

interface ArtifactPanelProps {
  artifacts: StoredArtifact[];
  regeneratingArtifactId?: string | null;
  onUpdateArtifact: (artifactId: string, content: string) => void;
  onRemoveArtifact: (artifactId: string) => void;
  onRegenerateArtifact: (artifact: StoredArtifact) => void;
  onOpenArtifact: (artifactId: string) => void;
}

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  artifacts,
  regeneratingArtifactId,
  onOpenArtifact,
  onRegenerateArtifact,
}) => {
  if (artifacts.length === 0) return null;

  const copyArtifact = async (artifact: StoredArtifact) => {
    await navigator.clipboard.writeText(artifact.content);
  };

  return (
    <Box sx={{ borderTop: '1px solid #e0e0e0', px: 2, py: 1.25, bgcolor: 'background.paper', flexShrink: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        Artifacts
      </Typography>
      <Stack spacing={1} sx={{ mt: 1, maxHeight: 132, overflowY: 'auto' }}>
        {artifacts.map((artifact) => (
          <Paper
            key={artifact.id}
            variant="outlined"
            sx={{ p: 1, borderRadius: 1, display: 'flex', gap: 1, alignItems: 'center' }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                {artifact.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {artifact.type.replace(/_/g, ' ')} - {artifactFormat(artifact)}
              </Typography>
            </Box>
            <Tooltip title="Copy">
              <IconButton size="small" onClick={() => copyArtifact(artifact)}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download">
              <IconButton size="small" onClick={() => downloadArtifact(artifact)}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Regenerate">
              <IconButton
                size="small"
                disabled={regeneratingArtifactId === artifact.id}
                onClick={() => onRegenerateArtifact(artifact)}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Open in Workspace">
              <IconButton size="small" onClick={() => onOpenArtifact(artifact.id)}>
                <OpenInFullIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
};
