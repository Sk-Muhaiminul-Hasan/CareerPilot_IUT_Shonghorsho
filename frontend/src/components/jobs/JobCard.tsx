import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BusinessIcon from '@mui/icons-material/Business';
import StarIcon from '@mui/icons-material/Star';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

import { useChatStore } from '@/store/useChatStore';
import type { Job } from '@/types/job';

interface JobCardProps {
  job: Job;
  onViewDetails: (jobId: string) => void;
  onApply?: (jobId: string) => void;
}

/** Map a work_type value to a Chip color/label. Returns null when unknown. */
function getWorkTypeChip(workType: string): { label: string; color: 'success' | 'info' | 'default' } | null {
  switch (workType) {
    case 'remote':
      return { label: 'Remote', color: 'success' };
    case 'hybrid':
      return { label: 'Hybrid', color: 'info' };
    case 'onsite':
      return { label: 'On-site', color: 'default' };
    default:
      return null;
  }
}

function JobCard({ job, onViewDetails, onApply }: JobCardProps) {
  const matchPercent = job.match_score != null ? Math.round(job.match_score * 100) : null;
  const workTypeChip = getWorkTypeChip(job.work_type);
const descriptionSnippet = job.description
       ? job.description.length > 120
          ? `${job.description.slice(0, 117)}...`
          : job.description
        : null;
    const openChatWithJob = useChatStore((s) => s.openChatWithJob);


  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap gutterBottom>
              {job.title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <BusinessIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {job.company}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: descriptionSnippet ? 0.5 : 0.5 }}>
              <LocationOnIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {job.location || (workTypeChip ? workTypeChip.label : 'Location not specified')}
              </Typography>
            </Box>
            {descriptionSnippet && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                {descriptionSnippet}
              </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {!job.is_enriched && !(job.description && job.description.length >= 100) && (
                <Tooltip title="Enrichment in progress">
                  <FiberManualRecordIcon
                    sx={{
                      fontSize: 10,
                      color: 'text.disabled',
                      animation: 'pulse 1.5s infinite',
                      '@keyframes pulse': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.3 },
                      },
                    }}
                  />
                </Tooltip>
              )}
              {!job.is_enriched && !(job.description && job.description.length >= 100) && (
                <Typography variant="caption" color="text.disabled">
                  Fetching details...
                </Typography>
              )}
            </Box>
          </Box>

          {matchPercent !== null && (
            <Chip
              icon={<StarIcon />}
              label={`${matchPercent}%`}
              color={matchPercent >= 75 ? 'success' : matchPercent >= 50 ? 'warning' : 'default'}
              size="small"
              sx={{ fontWeight: 600 }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
          <Chip label={job.platform} size="small" variant="outlined" />
          {workTypeChip
            ? <Chip label={workTypeChip.label} size="small" color={workTypeChip.color} variant="outlined" />
            : job.remote
              ? <Chip label="Remote" size="small" color="info" variant="outlined" />
              : null}
          {job.job_type && <Chip label={job.job_type} size="small" variant="outlined" />}
          {job.salary_range && (
            <Chip
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>💰</span>
                  <span>{job.salary_range}</span>
                </Box>
              }
              size="small"
              sx={{ bgcolor: 'success.light', color: 'success.contrastText', border: 'none', fontWeight: 500 }}
            />
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        <Button size="small" onClick={() => onViewDetails(job.id)}>
          View Details
        </Button>
        {onApply && (
          <Button size="small" variant="contained" onClick={() => onApply(job.id)}>
            Apply
          </Button>
        )}

        {/* Linked Pillar 3 Context Button */}
        <Button
          size="small"
          variant="outlined"
          color="secondary"
          onClick={() => {
            openChatWithJob(job.id);
          }}
        >
          Am I Ready?
        </Button>
      </CardActions>
    </Card>
  );
}

export default JobCard;
