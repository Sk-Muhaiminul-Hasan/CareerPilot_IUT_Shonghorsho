import React, { useState } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Link,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import RefreshIcon from '@mui/icons-material/Refresh';
import TableChartIcon from '@mui/icons-material/TableChart';
import type { StoredArtifact } from '@/store/useArtifactStore';
import { artifactFormat, downloadArtifact } from '@/utils/artifactFiles';

interface InlineArtifactsProps {
  artifacts: StoredArtifact[];
  regeneratingArtifactId?: string | null;
  onOpenArtifact: (artifactId: string) => void;
  onRegenerateArtifact: (artifact: StoredArtifact) => void;
}

const typeMeta = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('csv')) return { color: '#0ea371', bg: 'rgba(14,163,113,0.12)', icon: <TableChartIcon /> };
  if (t.includes('markdown') || t.includes('md') || t.includes('report') || t.includes('roadmap')) return { color: '#6d5ced', bg: 'rgba(109,92,237,0.12)', icon: <DescriptionIcon /> };
  return { color: '#0b64c4', bg: 'rgba(11,100,196,0.12)', icon: <DescriptionIcon /> };
};

const SimpleMarkdown: React.FC<{ value: string }> = ({ value }) => {
  const html = value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#101828;color:#f9fafb;padding:2px 6px;border-radius:4px;font-size:0.75rem;">$1</code>')
    .replace(/\n/g, '<br />');
  return <Box component="span" dangerouslySetInnerHTML={{ __html: html }} />;
};

const CsvTable: React.FC<{ value: string }> = ({ value }) => {
  const rows = value
    .trim()
    .split('\n')
    .filter(Boolean);
  if (rows.length === 0) return null;
  const headers = rows[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((h) => h.trim().replace(/^"|"$/g, ''));
  const body = rows.slice(1).map((row) =>
    row
      .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map((cell) => cell.trim().replace(/^"|"$/g, '')),
  );
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.82rem',
          lineHeight: 1.45,
        }}
      >
        <Box component="thead">
          <Box component="tr">
            {headers.map((h) => (
              <Box
                component="th"
                key={h}
                sx={{
                  textAlign: 'left',
                  borderBottom: '2px solid #c3c6d7',
                  borderRight: '1px solid #e2e8f0',
                  px: 1.5,
                  py: 1,
                  color: '#0b1c30',
                  fontWeight: 700,
                  backgroundColor: 'rgba(11,100,196,0.04)',
                }}
              >
                {h}
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {body.map((cells, idx) => (
            <Box component="tr" key={idx}>
              {cells.map((cell, ci) => (
                <Box
                  component="td"
                  key={`${idx}-${ci}`}
                  sx={{
                    borderBottom: '1px solid #f0f2f6',
                    borderRight: ci < cells.length - 1 ? '1px solid #f0f2f6' : 'none',
                    px: 1.5,
                    py: 0.75,
                    color: '#1a2740',
                  }}
                >
                  {cell}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export const InlineArtifacts: React.FC<InlineArtifactsProps> = ({
  artifacts,
  regeneratingArtifactId,
  onRegenerateArtifact,
}) => {
  const [preview, setPreview] = useState<StoredArtifact | null>(null);

  if (artifacts.length === 0) return null;

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        Generated
      </Typography>
      <Stack spacing={1} sx={{ mt: 0.75 }}>
        {artifacts.map((artifact) => {
          const { color, bg, icon } = typeMeta(artifact.type);
          const label = artifact.type.replace(/_/g, ' ').trim();
          return (
            <Paper
              key={artifact.id}
              elevation={0}
              sx={{
                p: 1,
                borderRadius: 1.5,
                display: 'flex',
                gap: 1.5,
                alignItems: 'center',
                background: 'linear-gradient(135deg, #f0f4ff 0%, #f5f0ff 100%)',
                border: '1px solid rgba(109,92,237,0.12)',
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  backgroundColor: bg,
                  color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  '& svg': { fontSize: 18 },
                }}
              >
                {icon}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: '#0b1c30' }}>
                  {artifact.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {label} — {artifactFormat(artifact)}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.25}>
                <Tooltip title="Copy">
                  <IconButton size="small" onClick={() => void navigator.clipboard.writeText(artifact.content)}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Download">
                  <IconButton size="small" onClick={() => void downloadArtifact(artifact)}>
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
                <Tooltip title="Expand">
                  <IconButton size="small" onClick={() => setPreview(artifact)}>
                    <OpenInFullIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Paper>
          );
        })}
      </Stack>

      <Dialog
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        maxWidth="md"
        fullWidth
        scroll="paper"
        PaperProps={{
          sx: {
            maxWidth: 900,
            borderRadius: 2.5,
            boxShadow: '0 24px 64px rgba(11, 28, 48, 0.22)',
          },
        }}
        BackdropProps={{
          sx: { backgroundColor: 'rgba(11, 28, 48, 0.55)', backdropFilter: 'blur(4px)' },
        }}
      >
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
          }}
        >
          {preview && (() => {
            const { color, bg, icon } = typeMeta(preview.type);
            return (
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  backgroundColor: bg,
                  color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  '& svg': { fontSize: 20 },
                }}
              >
                {icon}
              </Box>
            );
          })()}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Link
              href="#"
              onClick={(e) => e.preventDefault()}
              variant="h6"
              sx={{
                fontWeight: 700,
                color: '#0b1c30',
                lineHeight: 1.2,
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {preview?.title}
            </Link>
            {preview && (
              <Typography variant="caption" color="text.secondary">
                {preview.type.replace(/_/g, ' ')} — {artifactFormat(preview)}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Copy">
              <IconButton size="small" onClick={() => preview && void navigator.clipboard.writeText(preview.content)}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download">
              <IconButton size="small" onClick={() => preview && void downloadArtifact(preview)}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Regenerate">
              <IconButton size="small" onClick={() => preview && onRegenerateArtifact(preview)}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close">
              <IconButton size="small" onClick={() => setPreview(null)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <DialogContent sx={{ px: 3, py: 2.5, backgroundColor: '#ffffff' }}>
          <Box sx={{ mt: 0.5 }}>
            {preview && preview.format === 'csv' && <CsvTable value={preview.content} />}
            {preview && preview.format !== 'csv' && <SimpleMarkdown value={preview.content} />}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};
