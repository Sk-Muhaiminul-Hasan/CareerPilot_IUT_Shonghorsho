/**
 * Full-page goal management view for the Dashboard "Goals" tab.
 * Shows active goals with progress bars, a "Create New Goal" form,
 * and recently completed goals.
 *
 * Data comes from useGoals() — swap dashboardService.ts for real API calls.
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
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import BriefcaseIcon from '@mui/icons-material/WorkOutline';
import GroupIcon from '@mui/icons-material/Group';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import StarIcon from '@mui/icons-material/Star';
import Skeleton from '@mui/material/Skeleton';

import type { Goal } from '@/types/dashboard';
import { useGoals, CALENDAR_KEY, GOALS_KEY } from '@/hooks/useDashboard';
import { createGoal, createCalendarEvent, updateGoal } from '@/services/dashboardService';

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

/** Icon and label per goal type (derived from colorVariant for demo). */
const GOAL_META = [
  { icon: <BriefcaseIcon />, tag: 'Priority: High', tagColor: '#004ac6', tagBg: '#dbe1ff' },
  { icon: <GroupIcon />, tag: 'Habit', tagColor: '#712ae2', tagBg: '#eaddff' },
  { icon: <PsychologyIcon />, tag: 'Learning', tagColor: '#943700', tagBg: '#ffdbcd' },
];

function GoalCard({ goal, index, onEdit }: { goal: Goal; index: number; onEdit: (goal: Goal) => void }) {
  const progress = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
  const isOngoing = goal.dueLabel === 'Ongoing';
  const meta = GOAL_META[index % GOAL_META.length]!;
  const priorityColors: Record<string, string> = { High: '#dd2c00', Medium: '#f57c00', Low: '#2e7d32' };

  return (
    <Card sx={{ height: '100%' }}>
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
        </Box>

        {/* Title */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
          <Typography variant="subtitle1" fontWeight={700} color="text.primary" sx={{ flex: 1 }}>
            {goal.title}
          </Typography>
          <IconButton size="small" onClick={() => onEdit(goal)} sx={{ ml: 1 }}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flex: 1 }}>
          Target: {goal.target} {isOngoing ? '(ongoing)' : `items`}
        </Typography>

        {/* Progress */}
        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {isOngoing ? 'In Progress' : `${goal.current} / ${goal.target}`}
            </Typography>
            <Typography variant="body2" fontWeight={700} color={VARIANT_COLORS[goal.colorVariant]}>
              {isOngoing ? '—' : `${Math.round(progress)}%`}
            </Typography>
          </Box>
          <Box sx={{ height: 12, borderRadius: 9999, bgcolor: '#e5eeff', overflow: 'hidden' }}>
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

        {/* Footer */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5 }}>
          <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            {isOngoing ? 'Ongoing goal' : `Due: ${goal.dueLabel}`}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

/** Mock recently completed goals — replace with API data when available. */
const COMPLETED_GOALS = [
  { id: 'c1', title: 'Updated Resume (V2.1)', completedAt: 'Completed Sep 12, 2023' },
  { id: 'c2', title: 'Informational Interviews', completedAt: 'Completed Sep 08, 2023' },
];

export default function GoalsView() {
  const { data: goals, isLoading } = useGoals();
  const queryClient = useQueryClient();
  const [goalTitle, setGoalTitle] = useState('');
  const [category, setCategory] = useState('applications');
  const [colorVariant, setColorVariant] = useState('primary');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

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
    let createdGoal: Goal | null = null;
    if (editingGoal) {
      createdGoal = await updateGoal(editingGoal.id, payload);
      setEditingGoal(null);
    } else {
      createdGoal = await createGoal(payload);
    }
    setGoalTitle('');
    setCategory('applications');
    setColorVariant('primary');
    setDueDate('');
    setPriority('Medium');

    await queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
    await queryClient.invalidateQueries({ queryKey: GOALS_KEY });

    if (!editingGoal && createdGoal?.dueDate) {
      const deadlineDate = new Date(createdGoal.dueDate);
      deadlineDate.setHours(12, 0, 0, 0);
      await createCalendarEvent(createdGoal.title, deadlineDate);
      await queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
    }
    setIsSubmitting(false);
  }

  function handleEdit(goal: Goal) {
    setEditingGoal(goal);
    setGoalTitle(goal.title);
    setCategory('applications');
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
      <Box sx={{ flex: 1 }}>
        {/* Stats bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
          <Typography variant="h6" fontWeight={700} color="text.primary">
            Current Goals
          </Typography>
          <Chip label="3 Active" size="small" sx={{ bgcolor: '#e5eeff', color: '#004ac6', fontWeight: 700 }} />
          <Chip label="2 Paused" size="small" sx={{ bgcolor: '#f1f5f9', color: '#737686', fontWeight: 600 }} />
        </Box>

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
                    <Skeleton variant="rounded" height={12} sx={{ borderRadius: 9999, mt: 2 }} />
                  </CardContent>
                </Card>
              ))
            : (goals ?? []).map((goal, i) => (
                <GoalCard key={goal.id} goal={goal} index={i} onEdit={handleEdit} />
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
                  <MenuItem value="learning">Learning</MenuItem>
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
                  <MenuItem value="primary">Primary</MenuItem>
                  <MenuItem value="secondary">Secondary</MenuItem>
                  <MenuItem value="tertiary">Tertiary</MenuItem>
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
      <Box sx={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Streak card */}
        <Card>
          <CardContent sx={{ p: '20px !important' }}>
            <Typography variant="caption" color="#bc4800" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Current Streak
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
              <Typography sx={{ fontSize: '3rem', fontWeight: 800, color: 'text.primary', lineHeight: 1 }}>
                14
              </Typography>
              <Typography sx={{ fontSize: '2rem' }}>🔥</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">Top 5% of users</Typography>
              <Typography variant="caption" fontWeight={700} sx={{ color: '#1a7f4b' }}>+2 today</Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Recently Completed */}
        <Card>
          <CardContent sx={{ p: '20px !important' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>Recently Completed</Typography>
              <Button variant="text" size="small" sx={{ color: '#004ac6', textTransform: 'none', fontSize: '0.78rem' }}>
                View Archive
              </Button>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {COMPLETED_GOALS.map((g) => (
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
                      bgcolor: '#dcfce7', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CheckCircleIcon sx={{ color: '#1a7f4b', fontSize: 20 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap color="text.primary">
                      {g.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {g.completedAt}
                    </Typography>
                  </Box>
                  <Chip
                    label="Done"
                    size="small"
                    sx={{ bgcolor: '#dcfce7', color: '#1a7f4b', fontWeight: 700, fontSize: '0.68rem' }}
                  />
                </Box>
              ))}

              <Divider sx={{ my: 0.5 }} />
              <Box sx={{ textAlign: 'center', py: 1, px: 1.5, borderRadius: 2, border: '1.5px dashed #c3c6d7' }}>
                <Typography variant="caption" color="text.secondary">
                  You've reached 12 milestones this month! 🎉
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
