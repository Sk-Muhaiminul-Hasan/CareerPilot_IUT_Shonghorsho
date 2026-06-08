import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import JobCard from '@/components/jobs/JobCard';
import type { NudgeResponse } from '@/types/nudge';

interface NudgeCardProps {
  nudge: NudgeResponse | undefined;
  loading: boolean;
  onApply?: (jobId: string) => void;
  onViewDetails?: (jobId: string) => void;
}

const BULLET_ICONS = ['✓', '→', '★'];

function NudgeCard({ nudge, loading, onApply, onViewDetails }: NudgeCardProps) {

  if (loading) {
    return (
      <Card
        sx={{
          elevation: 0,
          border: '1px solid #e0e0e0',
          borderRadius: 2,
          mb: 3,
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Skeleton variant="text" width={200} height={32} />
            <Skeleton variant="rounded" width={80} height={24} />
          </Box>
          <Skeleton variant="text" width="100%" height={28} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="90%" height={28} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="95%" height={28} sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            {[0, 1, 2].map((i) => (
              <Grid item xs={12} md={4} key={i}>
                <Skeleton variant="rounded" height={160} />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    );
  }

  if (!nudge) {
    console.log('NudgeCard: no nudge data');
    return null;
  }

  console.log('NudgeCard suggested_todos:', nudge.suggested_todos);

  return (
    <Card
      sx={{
        elevation: 0,
        border: '1px solid #e0e0e0',
        borderRadius: 2,
        mb: 3,
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>
            {nudge.headline}
          </Typography>
          <Chip
            label="AI Nudge"
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        </Box>

        <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mb: 3 }}>
          {nudge.bullets.map((bullet, index) => (
            <Box
              component="li"
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                mb: 0.75,
              }}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 20,
                  height: 20,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  mt: '2px',
                }}
              >
                {BULLET_ICONS[index] || '•'}
              </Box>
              <Typography variant="body2" component="span">
                {bullet}
              </Typography>
            </Box>
          ))}
        </Box>

        {nudge.recommended_jobs.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              Recommended Jobs
            </Typography>
            <Grid container spacing={2}>
              {nudge.recommended_jobs.map((job) => (
                <Grid item xs={12} md={4} key={job.id}>
                  <JobCard job={job} onViewDetails={onViewDetails ?? (() => {})} onApply={onApply} />
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {nudge.suggested_todos.length > 0 && (
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              Suggested To-Dos
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {nudge.suggested_todos.map((todo) => (
                <Box
                  key={todo.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: 2,
                    border: '1px solid #e2e8f0',
                    bgcolor: todo.is_completed ? '#f1f5f9' : '#fff',
                  }}
                >
                  <Checkbox
                    checked={todo.is_completed}
                    disabled
                    sx={{ p: 0.5 }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      noWrap
                      sx={{
                        color: todo.is_completed ? 'text.disabled' : 'text.primary',
                        textDecoration: todo.is_completed ? 'line-through' : 'none',
                      }}
                    >
                      {todo.title}
                    </Typography>
                  </Box>
                  <Chip
                    label={`Prio ${todo.priority}`}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.68rem',
                      bgcolor: todo.priority === 3 ? '#fce4ec' : '#e8eaf6',
                      color: todo.priority === 3 ? '#c62828' : '#283593',
                    }}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default NudgeCard;
