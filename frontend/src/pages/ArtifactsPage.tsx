import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';

import { ArtifactVisualizer } from '@/components/assistant/ArtifactVisualizer';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { useArtifactStore, type StoredArtifact } from '@/store/useArtifactStore';
import { artifactFormat, downloadArtifact } from '@/utils/artifactFiles';

// ─── Type → colour + icon mapping ─────────────────────────────────────────────
const TYPE_META: Record<string, { color: string; bg: string; icon: React.ReactElement }> = {
  cover_letter:     { color: '#004ac6', bg: '#eff4ff', icon: <DescriptionOutlinedIcon /> },
  skill_gap_matrix: { color: '#7c3aed', bg: '#f5f0ff', icon: <BarChartOutlinedIcon /> },
  roadmap:          { color: '#059669', bg: '#ecfdf5', icon: <LayersOutlinedIcon /> },
  readiness_report: { color: '#d97706', bg: '#fffbeb', icon: <ArticleOutlinedIcon /> },
};

function typeMeta(type: string) {
  return TYPE_META[type] ?? { color: '#334155', bg: '#f1f5f9', icon: <CodeOutlinedIcon /> };
}

// ─── Skeleton placeholder card ─────────────────────────────────────────────────
function ArtifactSkeleton() {
  return (
    <Box
      sx={{
        height: 200,
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        backgroundColor: '#ffffff',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Skeleton variant="rounded" width={32} height={32} />
        <Skeleton variant="rounded" width={80} height={20} sx={{ borderRadius: 10 }} />
      </Stack>
      <Skeleton variant="text" width="70%" sx={{ fontSize: '1.1rem', mt: 0.5 }} />
      <Skeleton variant="rounded" height={80} sx={{ borderRadius: 1.5, flex: 1 }} />
      <Skeleton variant="text" width="45%" sx={{ fontSize: '0.75rem' }} />
    </Box>
  );
}

// ─── Individual artifact card ──────────────────────────────────────────────────
interface ArtifactCardProps {
  artifact: StoredArtifact;
  onClick: () => void;
}

function ArtifactCard({ artifact, onClick }: ArtifactCardProps) {
  const { color, bg, icon } = typeMeta(artifact.type);
  const label = artifact.type.replace(/_/g, ' ');
  const fmt = artifactFormat(artifact).toUpperCase();

  // First ~180 chars as preview text
  const preview = artifact.content.replace(/#+\s/g, '').trim().slice(0, 180);

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      sx={{
        height: 200,
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease',
        '&:hover': {
          boxShadow: `0 8px 28px rgba(11, 28, 48, 0.11)`,
          transform: 'translateY(-2px)',
          borderColor: color,
        },
        '&:focus-visible': {
          outline: `2px solid ${color}`,
          outlineOffset: 2,
        },
      }}
    >
      {/* Coloured top stripe */}
      <Box sx={{ height: 4, backgroundColor: color, flexShrink: 0 }} />

      <Box sx={{ px: 2, pt: 1.5, pb: 1.5, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Header row */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, flexShrink: 0 }}>
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: 1.5,
              backgroundColor: bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
              flexShrink: 0,
              '& svg': { fontSize: 17 },
            }}
          >
            {icon}
          </Box>
          <Chip
            label={label}
            size="small"
            sx={{
              fontSize: '0.68rem',
              fontWeight: 600,
              backgroundColor: bg,
              color,
              border: 'none',
              height: 20,
            }}
          />
          <Chip
            label={fmt}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.65rem', height: 20, ml: 'auto !important', color: '#64748b', borderColor: '#e2e8f0' }}
          />
        </Stack>

        {/* Title */}
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, color: '#0b1c30', lineHeight: 1.3, mb: 0.75, flexShrink: 0 }}
          noWrap
        >
          {artifact.title}
        </Typography>

        {/* Preview text */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            backgroundColor: '#f8f9ff',
            borderRadius: 1.5,
            px: 1.25,
            py: 0.75,
            mb: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: '#64748b',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 3,
              overflow: 'hidden',
            }}
          >
            {preview || 'No content preview available.'}
          </Typography>
        </Box>

        {/* Date */}
        <Typography variant="caption" sx={{ color: '#94a3b8', flexShrink: 0, fontSize: '0.68rem' }}>
          {new Date(artifact.created_at).toLocaleString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Full detail modal ─────────────────────────────────────────────────────────
interface ArtifactModalProps {
  artifact: StoredArtifact | null;
  onClose: () => void;
  onEdit: (artifact: StoredArtifact) => void;
  onDelete: (id: string) => void;
}

function ArtifactModal({ artifact, onClose, onEdit, onDelete }: ArtifactModalProps) {
  const copyArtifact = async () => {
    if (artifact) await navigator.clipboard.writeText(artifact.content);
  };

  return (
    <Dialog
      open={Boolean(artifact)}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{
        sx: {
          maxWidth: 800,
          borderRadius: 3,
          boxShadow: '0 24px 64px rgba(11, 28, 48, 0.18)',
        },
      }}
      BackdropProps={{
        sx: { backgroundColor: 'rgba(11, 28, 48, 0.55)', backdropFilter: 'blur(4px)' },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 3,
          pt: 2.5,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        {artifact && (() => {
          const { color, bg, icon } = typeMeta(artifact.type);
          return (
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                backgroundColor: bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color,
                flexShrink: 0,
                '& svg': { fontSize: 20 },
              }}
            >
              {icon}
            </Box>
          );
        })()}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0b1c30', lineHeight: 1.2 }} noWrap>
            {artifact?.title}
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            {artifact?.type.replace(/_/g, ' ')} · {artifact && artifactFormat(artifact).toUpperCase()} ·{' '}
            {artifact && new Date(artifact.created_at).toLocaleString(undefined, {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </Typography>
        </Box>
        <Tooltip title="Close">
          <IconButton onClick={onClose} size="small" sx={{ flexShrink: 0 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        {artifact && <ArtifactVisualizer artifact={artifact} />}
        <Box
          sx={{
            mt: artifact?.type === 'skill_gap_matrix' ? 2 : 0,
            p: 2,
            borderRadius: 2,
            backgroundColor: '#f8f9ff',
            border: '1px solid #e2e8f0',
          }}
        >
          <Typography
            component="pre"
            sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', m: 0, fontSize: '0.875rem', lineHeight: 1.7, color: '#1e293b' }}
          >
            {artifact?.content}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Tooltip title="Copy content">
          <Button size="small" startIcon={<ContentCopyIcon />} onClick={copyArtifact}>
            Copy
          </Button>
        </Tooltip>
        <Button size="small" startIcon={<EditIcon />} onClick={() => artifact && onEdit(artifact)}>
          Edit
        </Button>
        <Button size="small" startIcon={<DownloadIcon />} onClick={() => artifact && downloadArtifact(artifact)}>
          Download
        </Button>
        <Button
          size="small"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => { if (artifact) { onDelete(artifact.id); onClose(); } }}
        >
          Delete
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} variant="outlined" size="small">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Edit dialog ───────────────────────────────────────────────────────────────
interface EditDialogProps {
  artifact: StoredArtifact | null;
  draft: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

function EditDialog({ artifact, draft, onChange, onSave, onClose }: EditDialogProps) {
  return (
    <Dialog
      open={Boolean(artifact)}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
      BackdropProps={{ sx: { backgroundColor: 'rgba(11, 28, 48, 0.55)', backdropFilter: 'blur(4px)' } }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          pt: 2.5,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Edit Artifact</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent sx={{ px: 3, py: 2 }}>
        <TextField
          fullWidth
          multiline
          minRows={14}
          value={draft}
          onChange={(event) => onChange(event.target.value)}
          sx={{ mt: 0.5 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
function ArtifactsPage() {
  const artifacts = useArtifactStore((s) => s.artifacts);
  const updateArtifact = useArtifactStore((s) => s.updateArtifact);
  const removeArtifact = useArtifactStore((s) => s.removeArtifact);
  const clearArtifacts = useArtifactStore((s) => s.clearArtifacts);

  // Show skeleton cards until Zustand persist rehydrates from localStorage
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // persist.hasHydrated() is synchronous after first render
    const unsub = useArtifactStore.persist.onFinishHydration(() => setHydrated(true));
    if (useArtifactStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  const [viewing, setViewing] = useState<StoredArtifact | null>(null);
  const [editing, setEditing] = useState<StoredArtifact | null>(null);
  const [draft, setDraft] = useState('');

  const openEdit = (artifact: StoredArtifact) => {
    setViewing(null);
    setEditing(artifact);
    setDraft(artifact.content);
  };

  const saveArtifact = () => {
    if (!editing) return;
    updateArtifact(editing.id, draft);
    setEditing(null);
  };

  return (
    <ErrorBoundary>
      <Box>
        {/* Page header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ sm: 'flex-end' }}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#0b1c30', mb: 0.5 }}>
              Artifacts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Cover letters, gap analyses, roadmaps, and reports generated by Copilot.
            </Typography>
          </Box>
          <Button
            color="error"
            variant="outlined"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={clearArtifacts}
            disabled={artifacts.length === 0}
            sx={{ flexShrink: 0 }}
          >
            Clear all
          </Button>
        </Stack>

        {/* Skeleton grid while store rehydrates */}
        {!hydrated && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 2,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <ArtifactSkeleton key={i} />
            ))}
          </Box>
        )}

        {/* Empty state */}
        {hydrated && artifacts.length === 0 && (
          <Box
            sx={{
              textAlign: 'center',
              py: 10,
              px: 3,
              borderRadius: 3,
              border: '2px dashed #e2e8f0',
              backgroundColor: '#fafbff',
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                backgroundColor: '#eff4ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <Inventory2Icon sx={{ fontSize: 36, color: '#004ac6' }} />
            </Box>
            <Typography variant="h6" sx={{ color: '#0b1c30', fontWeight: 700, mb: 0.75 }}>
              No artifacts yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380, mx: 'auto' }}>
              Ask Copilot for a roadmap, cover letter, skill gap report, or readiness verdict — it will appear here.
            </Typography>
          </Box>
        )}

        {/* CSS grid of cards */}
        {hydrated && artifacts.length > 0 && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 2,
            }}
          >
            {artifacts.map((artifact) => (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                onClick={() => setViewing(artifact)}
              />
            ))}
          </Box>
        )}

        {/* Full detail modal */}
        <ArtifactModal
          artifact={viewing}
          onClose={() => setViewing(null)}
          onEdit={openEdit}
          onDelete={removeArtifact}
        />

        {/* Edit modal */}
        <EditDialog
          artifact={editing}
          draft={draft}
          onChange={setDraft}
          onSave={saveArtifact}
          onClose={() => setEditing(null)}
        />
      </Box>
    </ErrorBoundary>
  );
}

export default ArtifactsPage;
