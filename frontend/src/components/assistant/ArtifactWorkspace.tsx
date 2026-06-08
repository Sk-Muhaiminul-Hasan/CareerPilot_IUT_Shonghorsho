import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';

import { ArtifactVisualizer } from './ArtifactVisualizer';
import type { StoredArtifact } from '@/store/useArtifactStore';
import { downloadArtifact } from '@/utils/artifactFiles';

interface ArtifactWorkspaceProps {
  artifact: StoredArtifact;
  regeneratingArtifactId?: string | null;
  onUpdateArtifact: (artifactId: string, content: string) => void;
  onRemoveArtifact: (artifactId: string) => void;
  onRegenerateArtifact: (artifact: StoredArtifact) => void;
  onClose: () => void;
}

export const ArtifactWorkspace: React.FC<ArtifactWorkspaceProps> = ({
  artifact,
  regeneratingArtifactId,
  onUpdateArtifact,
  onRemoveArtifact,
  onRegenerateArtifact,
  onClose,
}) => {
  const [draft, setDraft] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Sync draft when artifact content changes (e.g. on load or regeneration)
  useEffect(() => {
    setDraft(artifact.content);
    setIsEditing(false);
  }, [artifact.id, artifact.content]);

  const copyContent = async () => {
    await navigator.clipboard.writeText(artifact.content);
  };

  const handleSave = () => {
    onUpdateArtifact(artifact.id, draft);
    setIsEditing(false);
  };

  const handleDelete = () => {
    onRemoveArtifact(artifact.id);
    onClose();
  };

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Workspace Header */}
      <Box
        sx={{
          px: 3,
          py: 1.75,
          borderBottom: '1px solid #c3c6d7',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8f9ff',
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0b1c30', noWrap: true }}>
            {artifact.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', noWrap: true }}>
            {artifact.filename || `${artifact.title}.${artifact.format}`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title="Copy to clipboard">
            <IconButton size="small" onClick={copyContent}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download file">
            <IconButton size="small" onClick={() => downloadArtifact(artifact)}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Regenerate with AI">
            <IconButton
              size="small"
              disabled={regeneratingArtifactId === artifact.id}
              onClick={() => onRegenerateArtifact(artifact)}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {isEditing ? (
            <Button
              size="small"
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              sx={{ ml: 1, borderRadius: 2 }}
            >
              Save
            </Button>
          ) : (
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setIsEditing(true)}
              sx={{ ml: 1, borderRadius: 2 }}
            >
              Edit
            </Button>
          )}

          <Tooltip title="Delete file">
            <IconButton size="small" onClick={handleDelete} color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Box sx={{ width: '1px', height: '24px', backgroundColor: '#c3c6d7', mx: 1 }} />

          <Tooltip title="Close Workspace">
            <IconButton size="small" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Workspace Content Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {isEditing ? (
          <Box sx={{ p: 2.5, flex: 1, display: 'flex' }}>
            <TextField
              fullWidth
              multiline
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              inputProps={{
                style: {
                  fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                  fontSize: '14px',
                  height: '100%',
                },
              }}
              sx={{
                flex: 1,
                '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start' },
                '& .MuiOutlinedInput-root': { height: '100%', borderRadius: 2 },
              }}
            />
          </Box>
        ) : (
          <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
            <ArtifactVisualizer artifact={artifact} />
          </Box>
        )}
      </Box>
    </Box>
  );
};
