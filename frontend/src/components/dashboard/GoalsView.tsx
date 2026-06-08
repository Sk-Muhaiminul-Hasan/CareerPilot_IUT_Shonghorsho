/**
 * Full-page goal management view for the Dashboard "Goals" tab.
 * Features:
 * – Active goals with progress bars, Mark as Done, and Delete actions.
 * – Create / Edit goal form (category includes "learning" so completions count as skills).
 * – Roadmap progress bar showing % of all goals completed.
 * – Real completed goals list from API with "skill" badge for learning goals.
 * – Current streak card driven by completed goal count.
 * – Generate Roadmap button on each goal card (Focus mode).
 */
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Checkbox from '@mui/material/Checkbox';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import BriefcaseIcon from '@mui/icons-material/WorkOutline';
import GroupIcon from '@mui/icons-material/Group';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import StarIcon from '@mui/icons-material/Star';
import SchoolIcon from '@mui/icons-material/School';
import MapIcon from '@mui/icons-material/Map';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

import type { Goal, Roadmap, RoadmapPhase, RoadmapTask } from '@/types/dashboard';
import { useGoals, useCompletedGoals, useRoadmap, useCompleteTaskMutation, DASHBOARD_KEY, CALENDAR_KEY, GOALS_KEY } from '@/hooks/useDashboard';
import { useAppStore } from '@/store/useAppStore';
import {
  createGoal,
  updateGoal,
  completeGoal,
  deleteGoalById,
  generateRoadmap,
  getRoadmap,
  completeRoadmapTask,
} from '@/services/dashboardService';
import MermaidChart from './MermaidChart';

/** Gradient colors per goal variant. */
const BAR_GRADIENT: Record<Goal['colorVariant'], string> = {
  primary: 'linear-gradient(90deg, #004ac6 0%, #2563eb 100%)',
  secondary: 'linear-gradient(90deg, #712ae2 0%, #8a4cfc 100%)',
  tertiary: 'linear-gradient(90deg, #943700 0%, #bc4800 100%)',
};

const VARIANT_COLORS: Record<Goal['colorVariant'], string> = {
  primary: '#004ac6',
  secondary: '#712ae2',
  tertiary: '#943700',
};

/** Icon per goal type. */
const GOAL_META = [
  { icon: <BriefcaseIcon /> },
  { icon: <GroupIcon /> },
  { icon: <PsychologyIcon /> },
];

const CATEGORY_LABEL: Record<string, string> = {
  applications: 'Applications',
  learning: 'Learning',
  networking: 'Networking',
  interview_prep: 'Interview Prep',
  other: 'Other',
};

function GoalCard({
  goal,
  index,
  onEdit,
  onComplete,
  onDelete,
  onOpenRoadmap,
}: {
  goal: Goal;
  index: number;
  onEdit: (goal: Goal) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenRoadmap: (goal: Goal) => void;
}) {
  const progress = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
  const isOngoing = goal.dueLabel === 'Ongoing';
  const meta = GOAL_META[index % GOAL_META.length]!;
  const priorityColors: Record<string, string> = { High: '#dd2c00', Medium: '#f57c00', Low: '#2e7d32' };
  const isLearning = goal.category === 'learning';

  return (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
      <CardContent sx={{ p: '24px !important', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box
            sx={{
              width: 44, height: 44, borderRadius: 2.5,
              bgcolor: `${VARIANT_COLORS[goal.colorVariant]}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: VARIANT_COLORS[goal.colorVariant],
            }}
          >
            {meta.icon}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Chip
              label={goal.priority}
              size="small"
              sx={{
                bgcolor: `${priorityColors[goal.priority] || '#666'}22`,
                color: priorityColors[goal.priority] || '#666',
                fontWeight: 700,
                fontSize: '0.68rem',
              }}
            />
            {isLearning && (
              <Tooltip title="Completing this will count as a skill added">
                <Chip
                  icon={<SchoolIcon sx={{ fontSize: '12px !important' }} />}
                  label="Skill"
                  size="small"
                  sx={{ bgcolor: '#eaddff', color: '#712ae2', fontWeight: 700, fontSize: '0.68rem' }}
                />
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Title + edit */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
          <Typography variant="subtitle1" fontWeight={700} color="text.primary" sx={{ flex: 1 }}>
            {goal.title}
          </Typography>
          <IconButton size="small" onClick={() => onEdit(goal)} sx={{ ml: 0.5 }}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Category tag */}
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
          {CATEGORY_LABEL[goal.category] ?? goal.category} · Target: {goal.target} {isOngoing ? '(ongoing)' : 'items'}
        </Typography>

        {/* Progress */}
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {isOngoing ? 'In Progress' : `${goal.current} / ${goal.target}`}
            </Typography>
            <Typography variant="body2" fontWeight={700} color={VARIANT_COLORS[goal.colorVariant]}>
              {isOngoing ? '—' : `${Math.round(progress)}%`}
            </Typography>
          </Box>
          <Box sx={{ height: 10, borderRadius: 9999, bgcolor: '#e5eeff', overflow: 'hidden' }}>
            <Box
              sx={{
                width: `${isOngoing ? 20 : progress}%`,
                height: '100%',
                background: BAR_GRADIENT[goal.colorVariant],
                borderRadius: 9999,
                transition: 'width 0.8s ease',
              }}
            />
          </Box>
        </Box>

        {/* Footer: due + actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AccessTimeIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {isOngoing ? 'Ongoing' : `Due: ${goal.dueLabel}`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Generate AI Roadmap (Focus mode)">
              <IconButton
                size="small"
                onClick={() => onOpenRoadmap(goal)}
                sx={{
                  color: '#712ae2',
                  bgcolor: '#f3e8ff',
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: '#e9d5ff' },
                  width: 30,
                  height: 30,
                }}
              >
                <AutoAwesomeIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Mark as completed">
              <IconButton
                size="small"
                onClick={() => onComplete(goal.id)}
                sx={{
                  color: '#1a7f4b',
                  bgcolor: '#dcfce7',
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: '#bbf7d0' },
                  width: 30,
                  height: 30,
                }}
              >
                <DoneAllIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete goal">
              <IconButton
                size="small"
                onClick={() => onDelete(goal.id)}
                sx={{
                  color: '#dd2c00',
                  bgcolor: '#fff1ef',
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: '#ffddd9' },
                  width: 30,
                  height: 30,
                }}
              >
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

/** Format completed_at date to a human label. */
function formatCompletedAt(iso: string | null): string {
  if (!iso) return 'Recently completed';
  const d = new Date(iso);
  return `Completed ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

// ---------------------------------------------------------------------------
// RoadmapPanel — inline expandable panel below the goal cards grid
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  learning: { bg: '#ede9fe', color: '#5b21b6' },
  project: { bg: '#dbeafe', color: '#1d4ed8' },
  application: { bg: '#dcfce7', color: '#15803d' },
  networking: { bg: '#fff7ed', color: '#c2410c' },
  cv_update: { bg: '#fef9c3', color: '#a16207' },
};

function RoadmapTaskRow({
  task,
  onComplete,
}: {
  task: RoadmapTask;
  onComplete: (id: string) => void;
}) {
  const cat = CATEGORY_COLORS[task.category] ?? { bg: '#f1f5f9', color: '#475569' };
  const dueStr = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: '8px 12px',
        borderRadius: 2,
        bgcolor: task.completed ? '#f0fdf4' : 'white',
        border: '1px solid',
        borderColor: task.completed ? '#bbf7d0' : '#e2e8f0',
        transition: 'all 0.2s',
        opacity: task.completed ? 0.75 : 1,
      }}
    >
      <Checkbox
        id={`rdm-task-${task.id}`}
        size="small"
        checked={task.completed}
        disabled={task.completed}
        onChange={() => !task.completed && onComplete(task.id)}
        sx={{ p: 0.25 }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            textDecoration: task.completed ? 'line-through' : 'none',
            color: task.completed ? 'text.secondary' : 'text.primary',
            lineHeight: 1.3,
          }}
        >
          {task.title}
        </Typography>
        {dueStr && (
          <Typography variant="caption" color="text.secondary">
            Due {dueStr}
          </Typography>
        )}
      </Box>
      <Chip
        label={task.category.replace('_', ' ')}
        size="small"
        sx={{ bgcolor: cat.bg, color: cat.color, fontWeight: 600, fontSize: '0.65rem', height: 20 }}
      />
    </Box>
  );
}

function PhaseSection({
  phase,
  onCompleteTask,
}: {
  phase: RoadmapPhase;
  onCompleteTask: (taskId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const doneCount = phase.tasks.filter((t) => t.completed).length;
  const pct = phase.tasks.length > 0 ? Math.round((doneCount / phase.tasks.length) * 100) : 0;

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          px: 1,
          py: 0.75,
          borderRadius: 1.5,
          '&:hover': { bgcolor: '#f8faff' },
        }}
      >
        {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
          Phase {phase.phaseNumber}: {phase.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
          Weeks {phase.weekStart}–{phase.weekEnd}
        </Typography>
        <Chip
          label={`${pct}%`}
          size="small"
          sx={{
            bgcolor: pct === 100 ? '#dcfce7' : '#e5eeff',
            color: pct === 100 ? '#16a34a' : '#004ac6',
            fontWeight: 700,
            fontSize: '0.68rem',
            height: 20,
          }}
        />
      </Box>
      <Collapse in={open}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, pl: 1, pt: 0.5 }}>
          {phase.tasks.map((task) => (
            <RoadmapTaskRow key={task.id} task={task} onComplete={onCompleteTask} />
          ))}
          {phase.tasks.length === 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
              No tasks in this phase.
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

function RoadmapPanel({
  goal,
  roadmap,
  loading,
  generating,
  error,
  onGenerate,
  onRegenerate,
  onCompleteTask,
  onClose,
}: {
  goal: Goal;
  roadmap: Roadmap | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  onRegenerate: () => void;
  onCompleteTask: (taskId: string) => void;
  onClose: () => void;
}) {
  const focusedGoalId = useAppStore((state) => state.focusedGoalId);
  const setFocusedGoalId = useAppStore((state) => state.setFocusedGoalId);
  const isFocused = focusedGoalId === goal.id;

  const feasibilityColors: Record<string, { bg: string; color: string }> = {
    high: { bg: '#dcfce7', color: '#16a34a' },
    medium: { bg: '#fef9c3', color: '#a16207' },
    low: { bg: '#fee2e2', color: '#dc2626' },
  };

  const fColor = (roadmap && feasibilityColors[roadmap.meta.feasibility]) || { bg: '#fef9c3', color: '#a16207' };

  return (
    <Card
      sx={{
        mt: 2,
        border: '2px solid #712ae2',
        borderRadius: 3,
        background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
        boxShadow: '0 8px 32px rgba(113,42,226,0.12)',
      }}
    >
      <CardContent sx={{ p: '24px !important' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon sx={{ color: '#712ae2', fontSize: 22 }} />
            <Typography variant="h6" fontWeight={700} color="#4c1d95">
              AI Roadmap — {goal.title}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {roadmap && (
              <>
                <Button
                  size="small"
                  variant={isFocused ? "contained" : "outlined"}
                  onClick={() => setFocusedGoalId(isFocused ? null : goal.id)}
                  sx={{
                    textTransform: 'none',
                    bgcolor: isFocused ? '#712ae2' : 'transparent',
                    color: isFocused ? 'white' : '#712ae2',
                    borderColor: '#712ae2',
                    fontWeight: 700,
                    borderRadius: 1.5,
                    px: 2,
                    '&:hover': {
                      bgcolor: isFocused ? '#5b21b6' : 'rgba(113,42,226,0.08)',
                      borderColor: '#5b21b6',
                    }
                  }}
                >
                  {isFocused ? 'Focused' : 'Focus'}
                </Button>
                <Tooltip title="Regenerate roadmap">
                  <IconButton size="small" onClick={onRegenerate} disabled={generating}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
            <Button size="small" onClick={onClose} sx={{ color: '#712ae2', textTransform: 'none' }}>
              Close
            </Button>
          </Box>
        </Box>

        {/* States */}
        {(loading || generating) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4, justifyContent: 'center' }}>
            <CircularProgress size={28} sx={{ color: '#712ae2' }} />
            <Typography variant="body2" color="text.secondary">
              {generating ? 'Generating your personalized roadmap with AI…' : 'Loading roadmap…'}
            </Typography>
          </Box>
        )}

        {error && !loading && !generating && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button size="small" onClick={onGenerate} sx={{ textTransform: 'none' }}>
                Generate Now
              </Button>
            }
          >
            {error.includes('not found') || error.includes('404')
              ? 'No roadmap yet. Generate one with AI!'
              : error}
          </Alert>
        )}

        {!roadmap && !loading && !generating && !error && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No roadmap generated yet. Click below to create an AI-powered roadmap for this goal.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={onGenerate}
              sx={{
                bgcolor: '#712ae2',
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                '&:hover': { bgcolor: '#5b21b6' },
              }}
            >
              Generate Roadmap
            </Button>
          </Box>
        )}

        {roadmap && !loading && !generating && (
          <>
            {/* Meta row */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2.5 }}>
              <Chip
                label={`Feasibility: ${roadmap.meta.feasibility}`}
                size="small"
                sx={{ bgcolor: fColor.bg, color: fColor.color, fontWeight: 700 }}
              />
              <Chip
                label={`~${roadmap.meta.weeklyHourBudget}h/week`}
                size="small"
                sx={{ bgcolor: '#e5eeff', color: '#004ac6', fontWeight: 600 }}
              />
              <Chip
                label={roadmap.meta.onTrack ? '✓ On Track' : '⚠ Behind Schedule'}
                size="small"
                sx={{
                  bgcolor: roadmap.meta.onTrack ? '#dcfce7' : '#fff7ed',
                  color: roadmap.meta.onTrack ? '#16a34a' : '#c2410c',
                  fontWeight: 700,
                }}
              />
              <Chip
                label={`${Math.round(roadmap.meta.progressPercent)}% complete`}
                size="small"
                sx={{ bgcolor: '#f1f5f9', color: '#334155', fontWeight: 600 }}
              />
            </Box>

            {/* Feasibility note */}
            {roadmap.meta.feasibilityNote && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                {roadmap.meta.feasibilityNote}
              </Typography>
            )}

            {/* Skill gaps */}
            {roadmap.meta.skillGaps && roadmap.meta.skillGaps.length > 0 && (
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  Skill Gaps to Address
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {roadmap.meta.skillGaps.map((sg, i) => (
                    <Tooltip key={i} title={sg.gap_reason}>
                      <Chip
                        label={sg.skill}
                        size="small"
                        sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 600, cursor: 'help' }}
                      />
                    </Tooltip>
                  ))}
                </Box>
              </Box>
            )}

            {/* Nudge message */}
            {roadmap.meta.nudgeMessage && (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: roadmap.meta.onTrack ? '#f0fdf4' : '#fff7ed',
                  border: '1px solid',
                  borderColor: roadmap.meta.onTrack ? '#bbf7d0' : '#fed7aa',
                  mb: 2.5,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ color: roadmap.meta.onTrack ? '#065f46' : '#9a3412', fontStyle: 'italic' }}
                >
                  {roadmap.meta.nudgeMessage}
                </Typography>
              </Box>
            )}

            {/* Mermaid Flowchart */}
            {roadmap.meta.mermaidGantt && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  Roadmap Workflow
                </Typography>
                <MermaidChart
                  chart={roadmap.meta.mermaidGantt}
                  maxHeight="350px"
                  onNodeClick={onCompleteTask}
                />
              </Box>
            )}

            <Divider sx={{ mb: 2 }} />

            {/* Phase task lists */}
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              Phases &amp; Tasks
            </Typography>
            {roadmap.phases.map((phase) => (
              <PhaseSection key={phase.id} phase={phase} onCompleteTask={onCompleteTask} />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function GoalsView() {
  const { data: goals, isLoading } = useGoals();
  const { data: completedGoals, isLoading: completedLoading } = useCompletedGoals();
  const queryClient = useQueryClient();
  const focusedGoalId = useAppStore((state) => state.focusedGoalId);
  const { data: focusedRoadmap } = useRoadmap(focusedGoalId);
  const completeTaskMutation = useCompleteTaskMutation();

  const [goalTitle, setGoalTitle] = useState('');
  const [category, setCategory] = useState('applications');
  const [colorVariant, setColorVariant] = useState('primary');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Roadmap panel state
  const [roadmapGoal, setRoadmapGoal] = useState<Goal | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapGenerating, setRoadmapGenerating] = useState(false);
  const [roadmapError, setRoadmapError] = useState<string | null>(null);

  const activeCount = goals?.length ?? 0;
  const completedCount = completedGoals?.length ?? 0;
  const totalGoals = activeCount + completedCount;
  const defaultRoadmapPercent = totalGoals > 0 ? Math.round((completedCount / totalGoals) * 100) : 0;
  const roadmapPercent = focusedRoadmap ? Math.round(focusedRoadmap.meta.progressPercent) : defaultRoadmapPercent;
  const skillsAdded = (completedGoals ?? []).filter((g) => g.category === 'learning').length;

  // ✅ MERGED: invalidate() from home_page_with_auth for goals/completed/weekly-progress
  // + CALENDAR_KEY from wasi-not-final so calendar also refreshes
  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: GOALS_KEY });
    await queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
  }

  async function handleSubmitGoal() {
    if (!goalTitle.trim()) return;
    setIsSubmitting(true);
    const payload = {
      title: goalTitle.trim(),
      targetValue: 1,
      category,
      colorVariant,
      dueDate: dueDate || null,
      dueLabel: dueDate || 'Ongoing',
      priority,
    };
    if (editingGoal) {
      await updateGoal(editingGoal.id, payload);
      setEditingGoal(null);
    } else {
      await createGoal(payload);
    }
    setGoalTitle('');
    setCategory('applications');
    setColorVariant('primary');
    setDueDate('');
    setPriority('Medium');
    // ✅ MERGED: invalidates goals + calendar in one call
    await invalidate();
    setIsSubmitting(false);
  }

  async function handleComplete(id: string) {
    await completeGoal(id);
    await invalidate();
  }

  async function handleDelete(id: string) {
    await deleteGoalById(id);
    await invalidate();
  }

  function handleEdit(goal: Goal) {
    setEditingGoal(goal);
    setGoalTitle(goal.title);
    setCategory(goal.category ?? 'applications');
    setColorVariant(goal.colorVariant);
    setDueDate(goal.dueDate || '');
    setPriority(goal.priority ?? 'Medium');
  }

  function handleCancelEdit() {
    setEditingGoal(null);
    setGoalTitle('');
    setCategory('applications');
    setColorVariant('primary');
    setDueDate('');
    setPriority('Medium');
  }

  async function handleOpenRoadmap(goal: Goal) {
    setRoadmapGoal(goal);
    setRoadmap(null);
    setRoadmapError(null);
    setRoadmapLoading(true);
    try {
      const existing = await getRoadmap(goal.id);
      setRoadmap(existing);
    } catch {
      // 404 = no roadmap yet
      setRoadmapError('not found');
    } finally {
      setRoadmapLoading(false);
    }
  }

  async function handleGenerateRoadmap() {
    if (!roadmapGoal) return;
    setRoadmapError(null);
    setRoadmapGenerating(true);
    try {
      const result = await generateRoadmap(roadmapGoal.id);
      setRoadmap(result);
      // Refresh dashboard progress widget
      await queryClient.invalidateQueries({ queryKey: [...DASHBOARD_KEY, 'dashboard-progress'] });
    } catch (err: any) {
      setRoadmapError(err?.detail ?? 'Failed to generate roadmap. Please try again.');
    } finally {
      setRoadmapGenerating(false);
    }
  }

  async function handleCompleteRoadmapTask(roadmapTaskId: string) {
    try {
      const { meta } = await completeRoadmapTask(roadmapTaskId);
      // Update the local roadmap with new meta and mark task done
      setRoadmap((prev) =>
        prev
          ? {
              ...prev,
              meta,
              phases: prev.phases.map((phase) => ({
                ...phase,
                tasks: phase.tasks.map((t) =>
                  t.id === roadmapTaskId ? { ...t, completed: true, completedAt: new Date().toISOString() } : t,
                ),
              })),
            }
          : prev,
      );
      await queryClient.invalidateQueries({ queryKey: [...DASHBOARD_KEY, 'dashboard-progress'] });
      await queryClient.invalidateQueries({ queryKey: [...DASHBOARD_KEY, 'roadmap'] });
      await queryClient.invalidateQueries({ queryKey: [...DASHBOARD_KEY, 'weekly-progress'] });
      await queryClient.invalidateQueries({ queryKey: [...DASHBOARD_KEY, 'goals'] });
    } catch (err) {
      console.error('Failed to complete roadmap task', err);
    }
  }

  return (
    <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'flex-start' }}>
      {/* ── Left: Current goals ──────────────────────────── */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Stats bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
          <Typography variant="h6" fontWeight={700} color="text.primary">
            Current Goals
          </Typography>
          <Chip
            label={`${activeCount} Active`}
            size="small"
            sx={{ bgcolor: '#e5eeff', color: '#004ac6', fontWeight: 700 }}
          />
          <Chip
            label={`${completedCount} Completed`}
            size="small"
            sx={{ bgcolor: '#dcfce7', color: '#1a7f4b', fontWeight: 700 }}
          />
          {skillsAdded > 0 && (
            <Chip
              icon={<SchoolIcon sx={{ fontSize: '14px !important' }} />}
              label={`${skillsAdded} Skill${skillsAdded !== 1 ? 's' : ''} Learned`}
              size="small"
              sx={{ bgcolor: '#eaddff', color: '#712ae2', fontWeight: 700 }}
            />
          )}
        </Box>

        {/* Roadmap progress bar card */}
        <Card sx={{ mb: 2.5, background: 'linear-gradient(135deg, #0b1c30 0%, #1e3a5f 100%)' }}>
          <CardContent sx={{ p: '20px !important' }}>
            {focusedRoadmap ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MapIcon sx={{ color: '#bc4800', fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={700} color="white">
                      Focused on "{focusedRoadmap.goalTitle}"
                    </Typography>
                  </Box>
                  <Typography
                    variant="h5"
                    fontWeight={800}
                    sx={{ color: roadmapPercent >= 50 ? '#34d399' : '#f59e0b', lineHeight: 1 }}
                  >
                    {roadmapPercent}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={roadmapPercent}
                  sx={{
                    height: 10,
                    borderRadius: 9999,
                    bgcolor: 'rgba(255,255,255,0.15)',
                    '& .MuiLinearProgress-bar': {
                      background: roadmapPercent >= 50
                        ? 'linear-gradient(90deg, #059669 0%, #34d399 100%)'
                        : 'linear-gradient(90deg, #b45309 0%, #f59e0b 100%)',
                      borderRadius: 9999,
                    },
                  }}
                />
                <Box sx={{ mt: 2.5, borderTop: '1px solid rgba(255,255,255,0.15)', pt: 2.5 }}>
                  <MermaidChart
                    chart={focusedRoadmap.meta.mermaidGantt}
                    maxHeight="300px"
                    onNodeClick={(taskId) => completeTaskMutation.mutate(taskId)}
                  />
                </Box>
              </>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MapIcon sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }} />
                  <Typography variant="subtitle2" fontWeight={700} color="white">
                    No goal is currently being followed
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mt: 1, display: 'block' }}>
                  Open any goal's roadmap panel and click "Focus" to follow its horizontal flowchart here.
                </Typography>
              </>
            )}
          </CardContent>
        </Card>

        {/* Goal cards grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 2,
            mb: 3,
          }}
        >
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent>
                    <Skeleton variant="rounded" width={44} height={44} sx={{ borderRadius: 2, mb: 2 }} />
                    <Skeleton variant="text" width="80%" />
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="rounded" height={10} sx={{ borderRadius: 9999, mt: 2 }} />
                  </CardContent>
                </Card>
              ))
            : (goals ?? []).length === 0 ? (
                <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    No active goals. Create one below to start tracking! 🚀
                  </Typography>
                </Box>
              )
            : (goals ?? []).map((goal, i) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  index={i}
                  onEdit={handleEdit}
                  onComplete={handleComplete}
                  onDelete={handleDelete}
                  onOpenRoadmap={handleOpenRoadmap}
                />
              ))}
        </Box>

        {roadmapGoal && (
          <Box sx={{ mb: 3 }}>
            <RoadmapPanel
              goal={roadmapGoal}
              roadmap={roadmap}
              loading={roadmapLoading}
              generating={roadmapGenerating}
              error={roadmapError}
              onGenerate={handleGenerateRoadmap}
              onRegenerate={handleGenerateRoadmap}
              onCompleteTask={handleCompleteRoadmapTask}
              onClose={() => setRoadmapGoal(null)}
            />
          </Box>
        )}

        {/* Create / Edit Goal form */}
        <Card sx={{ border: '1.5px dashed #c3c6d7' }}>
          <CardContent sx={{ p: '24px !important' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              {editingGoal ? <EditIcon sx={{ color: '#712ae2' }} /> : <AddCircleOutlineIcon sx={{ color: '#004ac6' }} />}
              <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                {editingGoal ? 'Edit Goal' : 'Create New Goal'}
              </Typography>
            </Box>

            <TextField
              label="Goal Title"
              placeholder="e.g. Portfolio Revamp"
              fullWidth
              size="small"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
              <TextField
                label="Deadline"
                type="date"
                size="small"
                sx={{ flex: 1 }}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={priority}
                  label="Priority"
                  onChange={(e) => setPriority(e.target.value as 'Low' | 'Medium' | 'High')}
                >
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={category}
                  label="Category"
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <MenuItem value="applications">Applications</MenuItem>
                  <MenuItem value="learning">Learning 🎓 (counts as skill)</MenuItem>
                  <MenuItem value="networking">Networking</MenuItem>
                  <MenuItem value="interview_prep">Interview Prep</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Color</InputLabel>
                <Select
                  value={colorVariant}
                  label="Color"
                  onChange={(e) => setColorVariant(e.target.value)}
                >
                  <MenuItem value="primary">Primary (Blue)</MenuItem>
                  <MenuItem value="secondary">Secondary (Purple)</MenuItem>
                  <MenuItem value="tertiary">Tertiary (Orange)</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<StarIcon />}
                disabled={isSubmitting || !goalTitle.trim()}
                onClick={handleSubmitGoal}
                sx={{
                  background: 'linear-gradient(90deg, #004ac6 0%, #712ae2 100%)',
                  fontWeight: 700,
                  textTransform: 'none',
                  py: 1.25,
                  borderRadius: 2,
                  '&.Mui-disabled': { opacity: 0.6 },
                }}
              >
                {isSubmitting ? 'Saving...' : editingGoal ? 'Update Goal' : 'Set Accountability Target'}
              </Button>
              {editingGoal && (
                <Button
                  variant="outlined"
                  onClick={handleCancelEdit}
                  sx={{ textTransform: 'none' }}
                >
                  Cancel
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* ── Right: Streak + Completed ─────────────────────── */}
      <Box sx={{ width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Streak card */}
        <Card>
          <CardContent sx={{ p: '20px !important' }}>
            <Typography variant="caption" color="#bc4800" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Current Streak
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
              <Typography sx={{ fontSize: '3rem', fontWeight: 800, color: 'text.primary', lineHeight: 1 }}>
                {completedCount}
              </Typography>
              <Typography sx={{ fontSize: '2rem' }}>🔥</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {completedCount === 0
                ? 'Complete your first goal to start your streak!'
                : `${completedCount} goal${completedCount !== 1 ? 's' : ''} achieved total`}
            </Typography>
          </CardContent>
        </Card>

        {/* Skills Learned card */}
        <Card sx={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' }}>
          <CardContent sx={{ p: '20px !important' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <SchoolIcon sx={{ color: '#d2bbff', fontSize: 20 }} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Skills Learned
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '2.5rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>
              {String(skillsAdded).padStart(2, '0')}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              from completed learning goals
            </Typography>
          </CardContent>
        </Card>

        {/* Recently Completed */}
        <Card>
          <CardContent sx={{ p: '20px !important' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>Recently Completed</Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {completedLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', p: 1.25, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                    <Skeleton variant="rounded" width={36} height={36} sx={{ borderRadius: 2, flexShrink: 0 }} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="80%" />
                      <Skeleton variant="text" width="60%" />
                    </Box>
                  </Box>
                ))
              ) : (completedGoals ?? []).length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    No completed goals yet. Mark a goal as done to see it here! ✅
                  </Typography>
                </Box>
              ) : (
                (completedGoals ?? []).slice(0, 5).map((g) => {
                  const isLearning = g.category === 'learning';
                  return (
                    <Box
                      key={g.id}
                      sx={{
                        display: 'flex', gap: 1.5, alignItems: 'center',
                        p: 1.25, borderRadius: 2, border: '1px solid #e2e8f0',
                        bgcolor: '#f8f9ff',
                      }}
                    >
                      <Box
                        sx={{
                          width: 36, height: 36, borderRadius: 2,
                          bgcolor: isLearning ? '#eaddff' : '#dcfce7',
                          display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isLearning
                          ? <SchoolIcon sx={{ color: '#712ae2', fontSize: 18 }} />
                          : <CheckCircleIcon sx={{ color: '#1a7f4b', fontSize: 18 }} />}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap color="text.primary">
                          {g.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatCompletedAt(g.completedAt)}
                        </Typography>
                      </Box>
                      <Chip
                        label={isLearning ? 'Skill' : 'Done'}
                        size="small"
                        sx={{
                          bgcolor: isLearning ? '#eaddff' : '#dcfce7',
                          color: isLearning ? '#712ae2' : '#1a7f4b',
                          fontWeight: 700,
                          fontSize: '0.68rem',
                          flexShrink: 0,
                        }}
                      />
                    </Box>
                  );
                })
              )}

              <Divider sx={{ my: 0.5 }} />
              <Box sx={{ textAlign: 'center', py: 1, px: 1.5, borderRadius: 2, border: '1.5px dashed #c3c6d7' }}>
                <Typography variant="caption" color="text.secondary">
                  {completedCount > 0
                    ? `🎉 ${completedCount} milestone${completedCount !== 1 ? 's' : ''} achieved!`
                    : 'Your completed goals will appear here.'}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
