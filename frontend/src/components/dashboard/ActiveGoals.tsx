import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';

import type { Goal } from '@/types/dashboard';

interface ActiveGoalsProps {
  goals: Goal[] | undefined;
  loading?: boolean;
  /** Called when the user clicks "Manage" — used to switch to the Goals tab. */
  onManage?: () => void;
}

/** Gradient colors for each variant, matching the design mockup. */
const BAR_GRADIENT: Record<Goal['colorVariant'], string> = {
  primary: 'linear-gradient(90deg, #004ac6 0%, #2563eb 100%)',
  secondary: 'linear-gradient(90deg, #712ae2 0%, #8a4cfc 100%)',
  tertiary: 'linear-gradient(90deg, #943700 0%, #bc4800 100%)',
};

function GoalRow({ goal }: { goal: Goal }) {
  const progress = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
  const isOngoing = goal.dueLabel === 'Ongoing';

  return (
    <Box sx={{ mb: 2.5 }}>
      {/* Title + current/target */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
        <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ lineHeight: 1.3 }}>
          {goal.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, ml: 1 }}>
          {isOngoing ? 'Ongoing' : `${goal.current}/${goal.target}`}
        </Typography>
      </Box>

      {/* Thick gradient progress bar */}
      <Box
        sx={{
          height: 12,
          borderRadius: 9999,
          bgcolor: '#e5eeff',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${isOngoing ? 20 : progress}%`,
            background: BAR_GRADIENT[goal.colorVariant],
            borderRadius: 9999,
            transition: 'width 0.6s ease',
          }}
        />
      </Box>
    </Box>
  );
}

function ActiveGoals({ goals, loading = false, onManage }: ActiveGoalsProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: '24px !important', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrackChangesIcon sx={{ color: '#004ac6', fontSize: 22 }} />
            <Typography variant="h6" fontWeight={700} color="text.primary">
              Active Goals
            </Typography>
          </Box>
          <Button
            variant="text"
            size="small"
            onClick={onManage}
            sx={{ color: '#004ac6', fontWeight: 600, textTransform: 'none', fontSize: '0.82rem' }}
          >
            Manage
          </Button>
        </Box>

        {/* Goals list */}
        <Box sx={{ flex: 1 }}>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Box key={i} sx={{ mb: 2.5 }}>
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="rounded" height={12} sx={{ borderRadius: 9999, mt: 0.75 }} />
              </Box>
            ))
          ) : !goals || goals.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No active goals. Create one to get started!
            </Typography>
          ) : (
            goals.map((goal) => <GoalRow key={goal.id} goal={goal} />)
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export default ActiveGoals;
