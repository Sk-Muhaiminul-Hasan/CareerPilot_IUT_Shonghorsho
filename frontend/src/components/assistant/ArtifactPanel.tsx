import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import { ArtifactVisualizer } from './ArtifactVisualizer';
import type { StoredArtifact } from '@/store/useArtifactStore';
import { artifactFormat, downloadArtifact } from '@/utils/artifactFiles';

interface ArtifactPanelProps {
  artifacts: StoredArtifact[];
  regeneratingArtifactId?: string | null;
  onUpdateArtifact: (artifactId: string, content: string) => void;
  onRemoveArtifact: (artifactId: string) => void;
  onRegenerateArtifact: (artifact: StoredArtifact) => void;
}

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  artifacts,
  regeneratingArtifactId,
  onUpdateArtifact,
  onRemoveArtifact,
  onRegenerateArtifact,
}) => {
  const [selected, setSelected] = React.useState<StoredArtifact | null>(null);
  const [draft, setDraft] = React.useState('');
  const [isEditing, setIsEditing] = React.useState(false);

  if (artifacts.length === 0) return null;

  const copyArtifact = async (artifact: StoredArtifact) => {
    await navigator.clipboard.writeText(artifact.content);
  };

  const openArtifact = (artifact: StoredArtifact) => {
    setSelected(artifact);
    setDraft(artifact.content);
    setIsEditing(false);
  };

  const saveArtifact = () => {
    if (!selected) return;
    onUpdateArtifact(selected.id, draft);
    setSelected({ ...selected, content: draft });
    setIsEditing(false);
  };

  const deleteSelected = () => {
    if (!selected) return;
    onRemoveArtifact(selected.id);
    setSelected(null);
  };

  return (
    <Box sx={{ borderTop: '1px solid #e0e0e0', px: 2, py: 1.25, bgcolor: 'background.paper' }}>
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
            <Tooltip title="Open">
              <IconButton size="small" onClick={() => openArtifact(artifact)}>
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
          {isEditing ? (
            <TextField
              fullWidth
              multiline
              minRows={14}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              sx={{ mt: 1 }}
            />
          ) : (
            <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', m: 0 }}>
              {selected?.content}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          {selected && <Button onClick={() => copyArtifact(selected)}>Copy</Button>}
          {selected && (
            <Button startIcon={<DownloadIcon />} onClick={() => downloadArtifact(selected)}>
              Download
            </Button>
          )}
          {selected && (
            <Button
              startIcon={<RefreshIcon />}
              disabled={regeneratingArtifactId === selected.id}
              onClick={() => onRegenerateArtifact(selected)}
            >
              Regenerate
            </Button>
          )}
          {selected && isEditing && (
            <Button startIcon={<SaveIcon />} variant="contained" onClick={saveArtifact}>
              Save
            </Button>
          )}
          {selected && !isEditing && (
            <Button startIcon={<EditIcon />} onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
          {selected && (
            <Button color="error" startIcon={<DeleteIcon />} onClick={deleteSelected}>
              Delete
            </Button>
          )}
          <Button onClick={() => setSelected(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
