import { useParams } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useJob } from '@/hooks/useJobs';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useApplication } from '@/hooks/useApplications';
import { useQueryClient } from '@tanstack/react-query';
import type { Application } from '@/types/application';

const APPLY_MODE_LABELS: Record<string, string> = {
  review: 'Reviewed before applying',
  autonomous: 'Auto Applied (Beta)',
  manual: 'Applied Manually',
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: 'default' | 'warning' | 'info' | 'success' | 'error' }
> = {
  pending_review: { label: 'Pending Review', color: 'warning' },
  applied: { label: 'Applied', color: 'success' },
  failed: { label: 'Failed', color: 'error' },
  applying: { label: 'Applying...', color: 'info' },
  queued: { label: 'Queued', color: 'default' },
  approved: { label: 'Approved', color: 'info' },
  interview: { label: 'Interview', color: 'success' },
  rejected: { label: 'Rejected', color: 'error' },
  offer: { label: 'Offer', color: 'success' },
  withdrawn: { label: 'Withdrawn', color: 'default' },
};

function ApplicationDetailPage() {
  const { appId } = useParams<{ appId: string }>();
  const queryClient = useQueryClient();

  const { data: appData, isLoading: appLoading, isError: appError } = useApplication(appId);

  const application: Application | undefined = appData;
  const jobId = application?.job_id ?? '';
  const { data: jobData, isLoading: jobLoading } = useJob(jobId || undefined);

  const { lastMessage } = useWebSocket('/ws/default_user', {
    onScore: ({ application_id, ats_score, reasoning }) => {
      if (application_id !== appId) return;
      queryClient.setQueryData<Application>(['applications', 'detail', appId as string], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ats_score: ats_score ?? prev.ats_score,
          reasoning: reasoning ?? prev.reasoning,
        };
      });
    },
  });

  if (appLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (appError || !application) {
    return (
      <Box>
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to load application.
        </Alert>
      </Box>
    );
  }

  const statusConf = STATUS_CONFIG[application.status] ?? { label: application.status, color: 'default' as const };
  const atsScore = application.ats_score ?? 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Application {application.id.slice(0, 8)}
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2 }}>
        {jobLoading ? 'Loading job details...' : jobData?.title ?? 'Job'}
        {(jobData?.company ?? '') ? <span> at {jobData.company}</span> : ''}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Chip label={APPLY_MODE_LABELS[application.apply_mode] ?? application.apply_mode} variant="outlined" />
        <Chip label={statusConf.label} color={statusConf.color} size="small" />
      </Box>
      {application.applied_at && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Applied on {new Date(application.applied_at).toLocaleString()}
        </Typography>
      )}

      {jobLoading ? (
        <Box sx={{ my: 2 }}>
          <Skeleton width={180} height={20} />
        </Box>
      ) : (
        <Box sx={{ my: 2 }}>
          <Chip label={`${jobData?.platform ?? 'Job'} • ${jobData?.location ?? ''}`} size="small" variant="outlined" />
        </Box>
      )}

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          ATS Score
        </Typography>
        {application.ats_score === null || application.ats_score === undefined ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 2 }}>
            <Skeleton variant="circular" width={72} height={72} />
            <Box>
              <Skeleton width={120} height={20} />
              <Skeleton width={80} height={16} sx={{ mt: 0.5 }} />
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 2 }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: atsScore >= 0.75 ? '#E1F5EE' : atsScore >= 0.5 ? '#FAEEDA' : '#FCEBEB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="h6" fontWeight={500} sx={{ color: atsScore >= 0.75 ? '#0F6E56' : atsScore >= 0.5 ? '#854F0B' : '#A32D2D' }}>
                {Math.round(atsScore * 100)}%
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">ATS Score</Typography>
              <Typography variant="caption" color="text.secondary">
                {atsScore >= 0.75 ? 'Strong match' : atsScore >= 0.5 ? 'Partial match' : 'Weak match'}
              </Typography>
            </Box>
          </Box>
        )}

        {application.reasoning === null || application.reasoning === undefined ? (
          <Box sx={{ my: 2 }}>
            <Skeleton width="40%" height={20} sx={{ mb: 1 }} />
            <Skeleton width="90%" height={16} sx={{ mb: 0.5 }} />
            <Skeleton width="75%" height={16} sx={{ mb: 0.5 }} />
            <Skeleton width="85%" height={16} sx={{ mb: 2 }} />
            <Skeleton width="40%" height={20} sx={{ mb: 1 }} />
            <Skeleton width="80%" height={16} sx={{ mb: 0.5 }} />
            <Skeleton width="70%" height={16} />
          </Box>
        ) : (
          <Box sx={{ my: 2 }}>
            <Typography variant="subtitle2" color="success.main" sx={{ mb: 1 }}>
              Why you match
            </Typography>
            {(application.reasoning as { matches?: string[] } | null)?.matches?.map((match: string, i: number) => (
              <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
                ✓ {match}
              </Typography>
            ))}
            <Typography variant="subtitle2" color="error.main" sx={{ mt: 2, mb: 1 }}>
              Gaps
            </Typography>
            {(application.reasoning as { gaps?: string[] } | null)?.gaps?.map((gap: string, i: number) => (
              <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
                ✗ {gap}
              </Typography>
            ))}
          </Box>
        )}
      </Box>

      {application.notes && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Notes: {application.notes}
        </Typography>
      )}
    </Box>
  );
}

export default ApplicationDetailPage;
