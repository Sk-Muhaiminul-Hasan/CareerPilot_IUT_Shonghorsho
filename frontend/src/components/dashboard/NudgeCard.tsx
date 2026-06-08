import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

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
    return null;
  }

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
          <Grid container spacing={2}>
            {nudge.recommended_jobs.map((job) => (
              <Grid item xs={12} md={4} key={job.id}>
                <JobCard job={job} onViewDetails={onViewDetails ?? (() => {})} onApply={onApply} />
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>
    </Card>
  );
}

export default NudgeCard;
