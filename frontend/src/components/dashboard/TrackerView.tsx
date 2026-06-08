/**
 * Kanban Application Tracker for the Dashboard "Tracker" tab.
 * Columns: Applied | Interviewing | Offer | Rejected
 * Cards show job info from ApplicationResponse schema.
 *
 * Data comes from useApplications() hook — real backend data.
 */
import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BoltIcon from '@mui/icons-material/Bolt';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BusinessIcon from '@mui/icons-material/Business';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';

import { useApplications } from '@/hooks/useApplications';
import { useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from '@/hooks/useTodos';
import type { Application } from '@/types/application';

/** Map application statuses to Kanban columns. */
const COLUMN_STATUS_MAP: Record<string, string[]> = {
  Applied: ['applied', 'applying'],
  Interviewing: ['interview'],
  Offer: ['offer'],
  Rejected: ['rejected', 'withdrawn', 'failed'],
};

const COLUMN_CONFIG = [
  { label: 'Applied', color: '#004ac6', lightColor: '#dbe1ff', borderColor: '#004ac6' },
  { label: 'Interviewing', color: '#712ae2', lightColor: '#eaddff', borderColor: '#712ae2' },
  { label: 'Offer', color: '#1a7f4b', lightColor: '#dcfce7', borderColor: '#1a7f4b' },
  { label: 'Rejected', color: '#737686', lightColor: '#f1f5f9', borderColor: '#c3c6d7' },
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function ApplicationCard({ app }: { app: Application }) {
  const when = app.applied_at ?? app.updated_at;
  return (
    <Card
      sx={{
        mb: 1.5,
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(11,28,48,0.04)',
        transition: 'box-shadow 0.15s, transform 0.15s',
        cursor: 'grab',
        '&:hover': {
          boxShadow: '0 6px 20px rgba(11,28,48,0.1)',
          transform: 'translateY(-1px)',
        },
      }}
    >
      <CardContent sx={{ p: '14px !important' }}>
        {/* Top row: time ago + menu */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
            {timeAgo(when)}
          </Typography>
          <IconButton size="small" sx={{ p: 0.25 }}>
            <MoreHorizIcon sx={{ fontSize: 16, color: '#737686' }} />
          </IconButton>
        </Box>

        {/* Company icon + job info */}
        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', mb: 1.25 }}>
          <Box
            sx={{
              width: 36, height: 36, borderRadius: 2,
              bgcolor: '#e5eeff', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <BusinessIcon sx={{ fontSize: 18, color: '#004ac6' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap color="text.primary">
              Job #{app.job_id.slice(0, 8)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              Mode: {app.apply_mode}
            </Typography>
          </Box>
        </Box>

        {/* Footer row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {app.ats_score != null && (
            <Chip
              label={`ATS ${Math.round(app.ats_score * 100)}%`}
              size="small"
              sx={{ bgcolor: '#e5eeff', color: '#004ac6', fontWeight: 700, fontSize: '0.65rem', height: 20 }}
            />
          )}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {app.notes ?? 'Sent'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

function KanbanColumn({
  config,
  apps,
  loading,
}: {
  config: typeof COLUMN_CONFIG[number];
  apps: Application[];
  loading: boolean;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 240,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Column header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 2,
          pb: 1.5,
          borderBottom: `2px solid ${config.color}`,
        }}
      >
        <Typography variant="subtitle1" fontWeight={700} color="text.primary">
          {config.label}
        </Typography>
        <Chip
          label={loading ? '…' : apps.length}
          size="small"
          sx={{
            bgcolor: config.lightColor,
            color: config.color,
            fontWeight: 700,
            height: 22,
            fontSize: '0.75rem',
          }}
        />
        <IconButton size="small" sx={{ ml: 'auto', p: 0.25 }}>
          <MoreHorizIcon sx={{ fontSize: 16, color: '#737686' }} />
        </IconButton>
      </Box>

      {/* Cards */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} sx={{ mb: 1.5, borderRadius: 3 }}>
              <CardContent>
                <Skeleton variant="rounded" width={36} height={36} sx={{ borderRadius: 2, mb: 1 }} />
                <Skeleton variant="text" width="75%" />
                <Skeleton variant="text" width="50%" />
              </CardContent>
            </Card>
          ))
        ) : apps.length === 0 ? (
          <Box
            sx={{
              border: '1.5px dashed #c3c6d7',
              borderRadius: 3,
              p: 2.5,
              textAlign: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              No applications here yet.
            </Typography>
          </Box>
        ) : (
          apps.map((app) => <ApplicationCard key={app.id} app={app} />)
        )}
      </Box>
    </Box>
  );
}

/** Bottom stat cards matching the application tracker design. */
function TrackerStats({ apps }: { apps: Application[] }) {
  const applied = apps.filter((a) => ['applied', 'applying'].includes(a.status)).length;
  const interviews = apps.filter((a) => a.status === 'interview').length;
  const responseRate = apps.length > 0 ? Math.round(((applied + interviews) / apps.length) * 100) : 0;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mt: 3 }}>
      <Card>
        <CardContent sx={{ p: '16px !important', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#e5eeff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUpIcon sx={{ fontSize: 18, color: '#004ac6' }} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Response Rate</Typography>
            <Typography variant="h6" fontWeight={800} color="text.primary">{responseRate}%</Typography>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: '16px !important', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#eaddff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BoltIcon sx={{ fontSize: 18, color: '#712ae2' }} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Active Streak</Typography>
            <Typography variant="h6" fontWeight={800} color="text.primary">12 Days</Typography>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: '16px !important', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#ffdbcd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AccessTimeIcon sx={{ fontSize: 18, color: '#943700' }} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Next Interview</Typography>
            <Typography variant="h6" fontWeight={800} color="text.primary">
              {interviews > 0 ? 'Tomorrow' : 'None yet'}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Card
        sx={{
          background: 'linear-gradient(135deg, #004ac6 0%, #712ae2 100%)',
          border: 'none',
        }}
      >
        <CardContent sx={{ p: '16px !important', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BoltIcon sx={{ fontSize: 18, color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>AI Insights</Typography>
            <Typography variant="h6" fontWeight={800} color="#fff">3 Tips Ready</Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default function TrackerView() {
  const { data: page1, isLoading } = useApplications(1, 100);
  const allApps = page1?.items ?? [];

  const { data: todos = [] } = useTodos('todo');
  const { data: doneTodos = [] } = useTodos('done');
  const createTodo = useCreateTodo();
  const completeTodo = useUpdateTodo();
  const removeTodo = useDeleteTodo();

  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<1 | 2 | 3>(2);

  const pendingTodos = todos
    .slice()
    .sort((a, b) => b.priority - a.priority);
  const allTodos = [...pendingTodos, ...doneTodos];

  async function handleAddTodo() {
    if (!newTitle.trim()) return;
    await createTodo.mutateAsync({
      title: newTitle.trim(),
      due_date: newDueDate || undefined,
      priority: newPriority,
    });
    setNewTitle('');
    setNewDueDate('');
    setNewPriority(2);
  }

  async function handleToggleTodo(todoId: string, isCompleted: boolean) {
    await completeTodo.mutateAsync({
      id: todoId,
      data: { is_completed: isCompleted ? false : true },
    });
  }

  async function handleDeleteTodo(todoId: string) {
    await removeTodo.mutateAsync(todoId);
  }

  // Distribute apps into columns
  const columnApps = COLUMN_CONFIG.map((col) => {
    const statuses = COLUMN_STATUS_MAP[col.label] ?? [];
    return {
      config: col,
      apps: allApps.filter((a) => statuses.includes(a.status.toLowerCase())),
    };
  });

  return (
    <Box>
      {/* Kanban board */}
      <Box
        sx={{
          display: 'flex',
          gap: 2.5,
          overflowX: 'auto',
          pb: 1,
          alignItems: 'flex-start',
          minHeight: 400,
        }}
      >
        {columnApps.map(({ config, apps }) => (
          <KanbanColumn key={config.label} config={config} apps={apps} loading={isLoading} />
        ))}
      </Box>

      {/* Todo List */}
      <Card sx={{ mt: 3 }}>
        <CardContent sx={{ p: '20px !important' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Todo List</Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
            <TextField
              label="New Task"
              placeholder="Add a to-do..."
              size="small"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Due Date"
              type="date"
              size="small"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />
            <FormControl size="small" sx={{ width: 120 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={newPriority}
                label="Priority"
                onChange={(e) => setNewPriority(Number(e.target.value) as 1 | 2 | 3)}
              >
                <MenuItem value={1}>Low</MenuItem>
                <MenuItem value={2}>Medium</MenuItem>
                <MenuItem value={3}>High</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              onClick={handleAddTodo}
              disabled={!newTitle.trim() || createTodo.isPending}
              sx={{ bgcolor: '#004ac6', '&:hover': { bgcolor: '#003b9e' } }}
            >
              Add
            </Button>
          </Box>

          {allTodos.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No todos yet. Add one above to stay on track.
            </Typography>
          ) : (
            allTodos.map((todo) => (
              <Box
                key={todo.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  py: 1,
                  px: 1.25,
                  borderRadius: 1,
                  '&:not(:last-child)': { borderBottom: '1px solid #f1f5f9' },
                }}
              >
                <IconButton
                  size="small"
                  onClick={() => handleToggleTodo(todo.id, todo.isCompleted)}
                  sx={{
                    color: todo.isCompleted ? '#1a7f4b' : '#c3c6d7',
                  }}
                >
                  <CheckCircleIcon sx={{ fontSize: 20 }} />
                </IconButton>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      textDecoration: todo.isCompleted ? 'line-through' : 'none',
                      color: todo.isCompleted ? 'text.disabled' : 'text.primary',
                    }}
                  >
                    {todo.title}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.25 }}>
                    <Typography variant="caption" color="text.secondary">
                      {todo.dueDate ? new Date(todo.dueDate).toLocaleDateString() : 'No due date'}
                    </Typography>
                    <Chip
                      label={todo.priority === 3 ? 'High' : todo.priority === 2 ? 'Medium' : 'Low'}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        bgcolor: todo.priority === 3 ? '#fde8e8' : todo.priority === 2 ? '#fff4db' : '#e5eeff',
                        color: todo.priority === 3 ? '#dc2626' : todo.priority === 2 ? '#b45309' : '#004ac6',
                      }}
                    />
                  </Box>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => handleDeleteTodo(todo.id)}
                  sx={{ color: '#737686' }}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            ))
          )}
        </CardContent>
      </Card>

      {/* Bottom stats */}
      <TrackerStats apps={allApps} />
    </Box>
  );
}
