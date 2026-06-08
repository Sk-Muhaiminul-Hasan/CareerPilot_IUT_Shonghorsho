import { useState } from 'react';
import {
  Box,
  LinearProgress,
  Stack,
  Typography,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { AssistantMarkdown } from './AssistantMarkdown';
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
  const [tabValue, setTabValue] = useState(0);

  // 1. Skill Gap Matrix rendering
  const rows = Array.isArray(artifact.data?.rows)
    ? artifact.data.rows.filter(isMatrixRow).slice(0, 6)
    : [];

  if (artifact.type === 'skill_gap_matrix' && rows.length > 0) {
    return (
      <Box sx={{ mt: 1, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
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

  // 2. HTML format rendering (Interactive Preview + Tabbed Code)
  if (artifact.format === 'html') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue: number) => setTabValue(newValue)}
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Tab label="Interactive Preview" />
          <Tab label="HTML Source" />
        </Tabs>
        {tabValue === 0 ? (
          <Paper variant="outlined" sx={{ p: 0.5, overflow: 'hidden' }}>
            <iframe
              srcDoc={artifact.content}
              title={artifact.title}
              sandbox="allow-scripts"
              style={{
                width: '100%',
                height: '480px',
                border: 'none',
                backgroundColor: '#ffffff',
              }}
            />
          </Paper>
        ) : (
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              borderRadius: 1,
              backgroundColor: '#101828',
              color: '#f9fafb',
              fontFamily: 'Consolas, Monaco, "Ubuntu Mono", monospace',
              fontSize: 13,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            <code>{artifact.content}</code>
          </Box>
        )}
      </Box>
    );
  }

  // 3. CSV format rendering (Structured Table Grid)
  if (artifact.format === 'csv') {
    const csvRows = (() => {
      try {
        const lines = artifact.content.split('\n').map(line => line.trim()).filter(Boolean);
        return lines.map(line => {
          return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(cell => cell.replace(/^"|"$/g, '').trim());
        });
      } catch (e) {
        return [];
      }
    })();

    if (csvRows.length > 0) {
      const headers = csvRows[0] || [];
      const dataRows = csvRows.slice(1);

      return (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                {headers.map((header, idx) => (
                  <TableCell key={`th-${idx}`} sx={{ fontWeight: 800 }}>
                    {header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {dataRows.map((row, rowIdx) => (
                <TableRow key={`tr-${rowIdx}`} hover>
                  {headers.map((_, colIdx) => (
                    <TableCell key={`td-${rowIdx}-${colIdx}`}>
                      {row[colIdx] ?? ''}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      );
    }
  }

  // 4. JSON format rendering
  if (artifact.format === 'json') {
    const formatted = (() => {
      try {
        return JSON.stringify(JSON.parse(artifact.content), null, 2);
      } catch (e) {
        return artifact.content;
      }
    })();

    return (
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          borderRadius: 1,
          backgroundColor: '#101828',
          color: '#f9fafb',
          fontFamily: 'Consolas, Monaco, "Ubuntu Mono", monospace',
          fontSize: 13,
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
        }}
      >
        <code>{formatted}</code>
      </Box>
    );
  }

  // 5. Beautiful Banners and Analysis wrappers for Reports & Roadmaps
  const matchScore = (() => {
    const text = artifact.content;
    const match = text.match(/\b(\d{1,3})%/i) || text.match(/\bscore:\s*(\d{1,3})/i);
    if (match) {
      const score = parseInt(match[1] as string, 10);
      if (score >= 0 && score <= 100) return score;
    }
    // Fallback default scores if none found in content
    if (artifact.type === 'readiness_report') return 75;
    if (artifact.type === 'skill_gap_report') return 60;
    return null;
  })();

  if (artifact.type === 'readiness_report' || artifact.type === 'skill_gap_report') {
    const scoreColor = matchScore && matchScore >= 80 ? '#00b0ff' : matchScore && matchScore >= 60 ? '#ff9100' : '#ff1744';
    const scoreLabel = matchScore && matchScore >= 80 ? 'Strong Match' : matchScore && matchScore >= 60 ? 'Good Potential' : 'Needs Gaps Addressed';
    
    return (
      <Box sx={{ color: 'text.primary' }}>
        {/* Modern Premium Analysis Banner */}
        <Box
          sx={{
            mb: 4,
            p: 3.5,
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #0b1c30 0%, #1a365d 100%)',
            color: '#ffffff',
            boxShadow: '0 8px 32px rgba(11, 28, 48, 0.24)',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Subtle glowing orb backgrounds */}
          <Box
            sx={{
              position: 'absolute',
              top: '-40px',
              right: '-40px',
              width: '180px',
              height: '180px',
              background: `radial-gradient(circle, ${scoreColor}2a 0%, transparent 70%)`,
              borderRadius: '50%',
              filter: 'blur(24px)',
            }}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center" justifyContent="space-between">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="overline" sx={{ letterSpacing: 2, color: 'rgba(255,255,255,0.6)', fontWeight: 800, display: 'block' }}>
                {artifact.type === 'readiness_report' ? 'AUTOMATED READINESS VERDICT' : 'AI SKILL GAP ASSESSMENT'}
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 900, letterSpacing: -0.5 }}>
                {artifact.title}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,0.8)', maxWidth: '520px', lineHeight: 1.5 }}>
                {artifact.description || 'Comprehensive evaluation matching your background directly against the target job profile.'}
              </Typography>
            </Box>

            {matchScore !== null && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <Box
                  sx={{
                    position: 'relative',
                    width: 90,
                    height: 90,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    border: '4px solid rgba(255,255,255,0.06)',
                    borderColor: `${scoreColor}33`,
                    boxShadow: `0 0 24px ${scoreColor}22`,
                    backgroundColor: 'rgba(11, 28, 48, 0.45)',
                  }}
                >
                  <Typography variant="h4" sx={{ fontWeight: 950, color: '#ffffff', letterSpacing: -1 }}>
                    {matchScore}
                    <Typography component="span" variant="caption" sx={{ fontSize: '14px', verticalAlign: 'super', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>%</Typography>
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ mt: 1, fontWeight: 800, color: scoreColor, letterSpacing: 1.5 }}>
                  {scoreLabel.toUpperCase()}
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>

        <AssistantMarkdown text={artifact.content} />
      </Box>
    );
  }

  if (artifact.type === 'roadmap') {
    return (
      <Box sx={{ color: 'text.primary' }}>
        {/* Modern Roadmap Banner */}
        <Box
          sx={{
            mb: 4,
            p: 3.5,
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #022c22 0%, #004d40 100%)',
            color: '#ffffff',
            boxShadow: '0 8px 32px rgba(2, 44, 34, 0.24)',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: '-40px',
              right: '-40px',
              width: '180px',
              height: '180px',
              background: 'radial-gradient(circle, rgba(0, 150, 136, 0.2) 0%, transparent 70%)',
              borderRadius: '50%',
              filter: 'blur(24px)',
            }}
          />
          <Typography variant="overline" sx={{ letterSpacing: 2, color: 'rgba(255,255,255,0.6)', fontWeight: 800, display: 'block' }}>
            PERSONALIZED EDUCATION PATHWAY
          </Typography>
          <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 900, letterSpacing: -0.5 }}>
            {artifact.title}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,0.8)', maxWidth: '580px', lineHeight: 1.5 }}>
            {artifact.description || 'Targeted learning milestones designed to build confidence, bridge skills gaps, and optimize match strength.'}
          </Typography>
        </Box>
        <AssistantMarkdown text={artifact.content} />
      </Box>
    );
  }

  // General Markdown
  const isMarkdown =
    artifact.format === 'markdown' ||
    artifact.format === 'md' ||
    ['markdown_document', 'assistant_draft'].includes(artifact.type);

  if (isMarkdown) {
    return (
      <Box sx={{ color: 'text.primary', '& p': { mb: 1.5 } }}>
        <AssistantMarkdown text={artifact.content} />
      </Box>
    );
  }

  // 6. Fallback (Plain Text/Code)
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 2,
        borderRadius: 1,
        backgroundColor: '#101828',
        color: '#f9fafb',
        fontFamily: 'Consolas, Monaco, "Ubuntu Mono", monospace',
        fontSize: 13,
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
      }}
    >
      <code>{artifact.content}</code>
    </Box>
  );
}
