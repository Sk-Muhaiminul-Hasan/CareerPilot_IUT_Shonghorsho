import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { StoredArtifact } from '@/store/useArtifactStore';

interface MatrixRow {
  skill: string;
  status: string;
  priority: number;
  score: number;
}

function isMatrixRow(value: unknown): value is MatrixRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.skill === 'string' && typeof row.score === 'number';
}

export function ArtifactVisualizer({ artifact }: { artifact: StoredArtifact }) {
  const rows = Array.isArray(artifact.data?.rows)
    ? artifact.data.rows.filter(isMatrixRow).slice(0, 6)
    : [];

  if (artifact.type !== 'skill_gap_matrix' || rows.length === 0) return null;

  return (
    <Box sx={{ mt: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Gap Analyzer
      </Typography>
      <Stack spacing={1}>
        {rows.map((row) => (
          <Box key={`${row.priority}-${row.skill}`}>
            <Stack direction="row" justifyContent="space-between" spacing={1}>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                {row.skill}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                P{row.priority}
              </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, row.score))} sx={{ mt: 0.5 }} />
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
