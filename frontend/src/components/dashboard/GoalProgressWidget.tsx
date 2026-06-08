/**
 * GoalProgressWidget — Dashboard Overview widget showing per-goal roadmap progress bars,
 * on-track badges, and nudge messages for goals that have an AI-generated roadmap.
 */
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import type { DashboardProgressItem, RoadmapFeasibility } from '@/types/dashboard';
import { useDashboardProgress, useRoadmap, useCompleteTaskMutation } from '@/hooks/useDashboard';
import { useAppStore } from '@/store/useAppStore';
import MermaidChart from './MermaidChart';

const FEASIBILITY_COLORS: Record<RoadmapFeasibility, { bg: string; color: string; label: string }> = {
  high: { bg: '#dcfce7', color: '#16a34a', label: 'High' },
  medium: { bg: '#fef9c3', color: '#a16207', label: 'Medium' },
  low: { bg: '#fee2e2', color: '#dc2626', label: 'Low' },
};

const PROGRESS_GRADIENT = {
  onTrack: 'linear-gradient(90deg, #059669 0%, #34d399 100%)',
  offTrack: 'linear-gradient(90deg, #b45309 0%, #f59e0b 100%)',
};

function ProgressItem({ item }: { item: DashboardProgressItem }) {
  const feasibility = FEASIBILITY_COLORS[item.feasibility] ?? FEASIBILITY_COLORS.medium;

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: '1px solid #e2e8f0',
        bgcolor: item.onTrack ? '#f8fff8' : '#fffdf0',
        transition: 'background 0.3s',
      }}
    >
      {/* Title row */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
        <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ flex: 1, lineHeight: 1.3 }}>
          {item.goalTitle}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, ml: 1, flexShrink: 0, alignItems: 'center' }}>
          <Tooltip title={`Feasibility: ${feasibility.label}`}>
            <Chip
              label={feasibility.label}
              size="small"
              sx={{ bgcolor: feasibility.bg, color: feasibility.color, fontWeight: 700, fontSize: '0.65rem', height: 20 }}
            />
          </Tooltip>
          <Tooltip title={item.onTrack ? 'On track' : 'Behind schedule'}>
            {item.onTrack
              ? <CheckCircleIcon sx={{ fontSize: 16, color: '#16a34a' }} />
              : <WarningAmberIcon sx={{ fontSize: 16, color: '#d97706' }} />}
          </Tooltip>
        </Box>
      </Box>

      {/* Progress bar */}
      <Box sx={{ mb: 0.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.4 }}>
          <Typography variant="caption" color="text.secondary">
            {item.onTrack ? 'On track' : 'Behind pace'}
          </Typography>
          <Typography variant="caption" fontWeight={700} sx={{ color: item.onTrack ? '#059669' : '#b45309' }}>
            {Math.round(item.progressPercent)}%
          </Typography>
        </Box>
        <Box sx={{ height: 8, borderRadius: 9999, bgcolor: '#e5eeff', overflow: 'hidden' }}>
          <Box
            sx={{
              width: `${item.progressPercent}%`,
              height: '100%',
              background: item.onTrack ? PROGRESS_GRADIENT.onTrack : PROGRESS_GRADIENT.offTrack,
              borderRadius: 9999,
              transition: 'width 0.8s ease',
            }}
          />
        </Box>
      </Box>

      {/* Nudge message */}
      {item.nudgeMessage && (
        <Typography
          variant="caption"
          sx={{
            color: item.onTrack ? '#065f46' : '#92400e',
            fontStyle: 'italic',
            lineHeight: 1.4,
            display: 'block',
          }}
        >
          {item.nudgeMessage}
        </Typography>
      )}
    </Box>
  );
}

interface GoalProgressWidgetProps {
  onManageGoals?: () => void;
}

export default function GoalProgressWidget({ onManageGoals }: GoalProgressWidgetProps) {
  const { data: items, isLoading } = useDashboardProgress();
  const focusedGoalId = useAppStore((state) => state.focusedGoalId);
  const { data: focusedRoadmap } = useRoadmap(focusedGoalId);
  const completeTaskMutation = useCompleteTaskMutation();

  // If no roadmaps exist yet, don't render the widget
  if (!isLoading && (!items || items.length === 0) && !focusedGoalId) {
    return null;
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: '24px !important', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon sx={{ color: '#712ae2', fontSize: 20 }} />
            <Typography variant="h6" fontWeight={700} color="text.primary">
              Roadmap Progress
            </Typography>
          </Box>
          {onManageGoals && (
            <Typography
              component="button"
              variant="caption"
              onClick={onManageGoals}
              sx={{
                color: '#004ac6',
                fontWeight: 600,
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                fontSize: '0.8rem',
                p: 0,
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Manage
            </Typography>
          )}
        </Box>

        {/* Focused Roadmap Flowchart (if active) */}
        {focusedRoadmap && (
          <Box sx={{ mb: 3, p: 2, borderRadius: 2.5, bgcolor: '#faf5ff', border: '1px dashed #712ae2' }}>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              color="#4c1d95"
              sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 16, color: '#712ae2' }} /> Focused Roadmap: {focusedRoadmap.goalTitle}
            </Typography>
            <MermaidChart
              chart={focusedRoadmap.meta.mermaidGantt}
              maxHeight="300px"
              onNodeClick={(taskId) => completeTaskMutation.mutate(taskId)}
            />
          </Box>
        )}

        {/* Items */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, flex: 1 }}>
          {isLoading
            ? Array.from({ length: 2 }).map((_, i) => (
                <Box key={i} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                  <Skeleton variant="text" width="70%" sx={{ mb: 0.75 }} />
                  <Skeleton variant="rounded" height={8} sx={{ borderRadius: 9999 }} />
                </Box>
              ))
            : (items ?? []).map((item) => <ProgressItem key={item.goalId} item={item} />)}
        </Box>
      </CardContent>
    </Card>
  );
}
