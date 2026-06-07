import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
  import { useChatStore } from '@/store/useChatStore';
import { useJob } from '@/hooks/useJobs';
import LoadingState from '@/components/common/LoadingState';

interface JobDetailProps {
  jobId: string | null;
  open: boolean;
  onClose: () => void;
  onApply?: (jobId: string) => void;
}

function JobDetail({ jobId, open, onClose, onApply }: JobDetailProps) {
  const { data: job, isLoading, isError } = useJob(jobId ?? undefined);
  const openChatWithJob = useChatStore((s) => s.openChatWithJob);

  const formatDeadline = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const deadlineDate = job?.deadline ? new Date(job.deadline) : null;
  const isDeadlineSoon =
    deadlineDate != null &&
    !Number.isNaN(deadlineDate.getTime()) &&
    (deadlineDate.getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': { width: { xs: '100%', sm: 480 } },
      }}
    >
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Job Details</Typography>
          <IconButton onClick={onClose} aria-label="Close job details">
            <CloseIcon />
          </IconButton>
        </Box>

        {isLoading && <LoadingState message="Loading job details..." />}

        {isError && (
          <Typography color="error" variant="body2">
            Failed to load job details. Please try again.
          </Typography>
        )}

        {job && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <Tooltip title={job.is_enriched ? 'Enrichment complete' : 'Enrichment in progress'}>
                <FiberManualRecordIcon
                  sx={{
                    fontSize: 10,
                    color: job.is_enriched ? 'success.main' : 'text.disabled',
                    animation: job.is_enriched ? 'none' : 'pulse 1.5s infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.3 },
                    },
                  }}
                />
              </Tooltip>
              {!job.is_enriched && (
                <Typography variant="caption" color="text.disabled">
                  Fetching details...
                </Typography>
              )}
            </Box>

            <Typography variant="h5" gutterBottom>
              {job.title}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <BusinessIcon fontSize="small" color="action" />
              <Typography variant="body1" color="text.secondary">
                {job.company}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <LocationOnIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {job.location || 'Remote'}
              </Typography>
            </Box>

            {job.posted_date && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <CalendarTodayIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  Posted {new Date(job.posted_date).toLocaleDateString()}
                </Typography>
              </Box>
            )}

            {job.salary_range && (
              <Box sx={{ mb: 1.5, px: 1.5, py: 1, borderRadius: 1, bgcolor: 'success.light', color: 'success.contrastText', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  💰 {job.salary_range}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
              <Chip label={job.platform} size="small" />
              {(job as Record<string, unknown>).work_type && (
                <Chip
                  label={(job as Record<string, string>).work_type}
                  size="small"
                  color={
                    (job as Record<string, string>).work_type === 'remote'
                      ? 'success'
                      : (job as Record<string, string>).work_type === 'hybrid'
                        ? 'info'
                        : 'default'
                  }
                />
              )}
              {job.remote && <Chip label="Remote" size="small" color="info" />}
              {job.job_type && <Chip label={job.job_type} size="small" />}
              {job.experience_level && <Chip label={job.experience_level} size="small" />}
              {job.salary_range && (
                <Chip label={job.salary_range} size="small" color="secondary" />
              )}
              {deadlineDate && !Number.isNaN(deadlineDate.getTime()) && (
                <Chip
                  icon={<CalendarTodayIcon />}
                  label={`Apply by ${formatDeadline(job.deadline!)}`}
                  size="small"
                  color={isDeadlineSoon ? 'warning' : 'default'}
                />
              )}
              {job.skills_required && typeof job.skills_required === 'object' && (
                Object.entries(job.skills_required).map(([key, value]) => {
                  const label = typeof value === 'string' ? value : key;
                  return (
                    <Chip key={key} label={label} size="small" variant="outlined" color="primary" />
                  );
                })
              )}
            </Box>

            {job.match_score != null && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Match Score
                </Typography>
                <Chip
                  label={`${Math.round(job.match_score * 100)}%`}
                  color={
                    job.match_score >= 0.75
                      ? 'success'
                      : job.match_score >= 0.5
                        ? 'warning'
                        : 'default'
                  }
                />
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              Description
            </Typography>
            <Box
              sx={{
                maxHeight: 240,
                overflowY: 'auto',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                p: 1.5,
                mb: 3,
              }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ whiteSpace: 'pre-wrap' }}
              >
                {job.description || 'No description available.'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              {onApply && (
                <Button variant="contained" onClick={() => onApply(job.id)}>
                  Apply Now
                </Button>
              )}
              <Button
                variant="outlined"
                endIcon={<OpenInNewIcon />}
                component="a" // or Link depending on base implementation
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Original
              </Button>

              {/* Linked Pillar 3 Context Button */}
              <Button
                variant="contained"
                color="secondary"
                onClick={() => {
                  // Close this detail view if needed, or keep it open and pop out the Copilot!
                  openChatWithJob(job.id);
                }}
              >
                Am I Ready?
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Drawer>
  );
}

export default JobDetail;
