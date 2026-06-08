/**
 * Full-page goal management view for the Dashboard "Goals" tab.
 * Features:
 * – Active goals with progress bars, Mark as Done, and Delete actions.
 * – Create / Edit goal form (category includes "learning" so completions count as skills).
 * – Roadmap progress bar showing % of all goals completed.
 * – Real completed goals list from API with "skill" badge for learning goals.
 * – Current streak card driven by completed goal count.
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

import type { Goal } from '@/types/dashboard';
// ✅ MERGED: useCompletedGoals from home_page_with_auth + CALENDAR_KEY/GOALS_KEY from wasi-not-final
import { useGoals, useCompletedGoals, CALENDAR_KEY, GOALS_KEY } from '@/hooks/useDashboard';
// ✅ MERGED: completeGoal + deleteGoalById from home_page_with_auth (needed for buttons)
import { createGoal, updateGoal, completeGoal, deleteGoalById } from '@/services/dashboardService';

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
}: {
  goal: Goal;
  index: number;
  onEdit: (goal: Goal) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
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

export default function GoalsView() {
  const { data: goals, isLoading } = useGoals();
  const { data: completedGoals, isLoading: completedLoading } = useCompletedGoals();
  const queryClient = useQueryClient();

  const [goalTitle, setGoalTitle] = useState('');
  const [category, setCategory] = useState('applications');
  const [colorVariant, setColorVariant] = useState('primary');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const activeCount = goals?.length ?? 0;
  const completedCount = completedGoals?.length ?? 0;
  const totalGoals = activeCount + completedCount;
  const roadmapPercent = totalGoals > 0 ? Math.round((completedCount / totalGoals) * 100) : 0;
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

        {/* Roadmap progress bar */}
        <Card sx={{ mb: 2.5, background: 'linear-gradient(135deg, #0b1c30 0%, #1e3a5f 100%)' }}>
          <CardContent sx={{ p: '20px !important' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MapIcon sx={{ color: '#bc4800', fontSize: 20 }} />
                <Typography variant="subtitle2" fontWeight={700} color="white">
                  Career Roadmap Progress
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                {completedCount} of {totalGoals} goals completed
              </Typography>
              {skillsAdded > 0 && (
                <Typography variant="caption" sx={{ color: '#d2bbff', fontWeight: 600 }}>
                  🎓 {skillsAdded} skill{skillsAdded !== 1 ? 's' : ''} added
                </Typography>
              )}
            </Box>
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
                />
              ))}
        </Box>

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