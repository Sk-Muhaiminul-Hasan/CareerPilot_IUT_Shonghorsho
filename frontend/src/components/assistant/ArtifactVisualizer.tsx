import React, { useState } from 'react';
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

  // 5. Markdown/roadmap format rendering
  const isMarkdown =
    artifact.format === 'markdown' ||
    artifact.format === 'md' ||
    ['roadmap', 'markdown_document', 'skill_gap_report', 'readiness_report', 'assistant_draft'].includes(artifact.type);

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
