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
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CircularProgress from '@mui/material/CircularProgress';

import { ArtifactVisualizer } from './ArtifactVisualizer';
import type { StoredArtifact } from '@/store/useArtifactStore';
import { downloadArtifact, downloadArtifactAsPdf } from '@/utils/artifactFiles';
import { updateResumeContent } from '@/services/resumeService';
import { useAppStore } from '@/store/useAppStore';

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
  const [isSaving, setIsSaving] = useState(false);

  // Sync draft when artifact content changes (e.g. on load or regeneration)
  useEffect(() => {
    setDraft(artifact.content);
    setIsEditing(false);
  }, [artifact.id, artifact.content]);

  const copyContent = async () => {
    await navigator.clipboard.writeText(artifact.content);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      onUpdateArtifact(artifact.id, draft);
      const resumeId = artifact.data?.resume_id as string | undefined;
      if (resumeId) {
        await updateResumeContent(resumeId, { content_text: draft });
        useAppStore.getState().showNotification('Resume content successfully synced to Resume Section!', 'success');
      } else {
        useAppStore.getState().showNotification('Artifact saved successfully!', 'success');
      }
    } catch (err: any) {
      console.error('Failed to sync edited resume back to Resume section:', err);
      useAppStore.getState().showNotification('Successfully updated workspace copy, but failed to sync to database.', 'warning');
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
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
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0b1c30', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {artifact.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {artifact.filename || `${artifact.title}.${artifact.format}`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title="Copy to clipboard">
            <IconButton size="small" onClick={copyContent}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download original format">
            <IconButton size="small" onClick={() => downloadArtifact(artifact)}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download as PDF">
            <IconButton size="small" onClick={() => downloadArtifactAsPdf(artifact)}>
              <PictureAsPdfIcon fontSize="small" style={{ color: '#d32f2f' }} />
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
              startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={isSaving}
              sx={{ ml: 1, borderRadius: 2 }}
            >
              {isSaving ? 'Saving...' : 'Save'}
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
