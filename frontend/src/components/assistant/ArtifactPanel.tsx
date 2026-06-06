import React from 'react';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  Button,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { ArtifactVisualizer } from './ArtifactVisualizer';
import type { StoredArtifact } from '@/store/useArtifactStore';
import { artifactFormat, downloadArtifact } from '@/utils/artifactFiles';

interface ArtifactPanelProps {
  artifacts: StoredArtifact[];
}

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({ artifacts }) => {
  const [selected, setSelected] = React.useState<StoredArtifact | null>(null);

  if (artifacts.length === 0) return null;

  const copyArtifact = async (artifact: StoredArtifact) => {
    await navigator.clipboard.writeText(artifact.content);
  };

  return (
    <Box sx={{ borderTop: '1px solid #e0e0e0', px: 2, py: 1.25, bgcolor: 'background.paper' }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        Artifacts
      </Typography>
      <Stack spacing={1} sx={{ mt: 1, maxHeight: 130, overflowY: 'auto' }}>
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
                {artifact.type.replace(/_/g, ' ')} · {artifactFormat(artifact)}
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
            <Tooltip title="Open">
              <IconButton size="small" onClick={() => setSelected(artifact)}>
                <OpenInFullIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Paper>
        ))}
      </Stack>
      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="md">
        <DialogTitle>{selected?.title}</DialogTitle>
        <DialogContent dividers>
          {selected && <ArtifactVisualizer artifact={selected} />}
          <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', m: 0 }}>
            {selected?.content}
          </Typography>
        </DialogContent>
        <DialogActions>
          {selected && <Button onClick={() => copyArtifact(selected)}>Copy</Button>}
          <Button onClick={() => setSelected(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
