import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { useJob } from '@/hooks/useJobs';
import { useApplication, useGenerateCoverLetter } from '@/hooks/useApplications';
import { downloadCoverLetter } from '@/services/applicationService';
import { generateResume, getDownloadUrl } from '@/services/resumeService';
import { useQueryClient } from '@tanstack/react-query';
import TemplateSelector from '@/components/resumes/TemplateSelector';
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
  const generateCoverLetterMutation = useGenerateCoverLetter();
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const [resumeGenerating, setResumeGenerating] = useState(false);
  const [resumeGenerateError, setResumeGenerateError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  const [generatedResumeId, setGeneratedResumeId] = useState<string | null>(null);

  useEffect(() => {
    if (!appId) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//localhost:8000/ws/default_user`);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'application_scored' && msg.application_id === appId) {
          queryClient.invalidateQueries({ queryKey: ['applications', 'detail', appId] });
        }
      } catch {}
    };
    return () => ws.close();
  }, [appId, queryClient]);

  const application: Application | undefined = appData;
  const jobId = application?.job_id ?? '';
  const { data: jobData, isLoading: jobLoading } = useJob(jobId || undefined);

  const handleGenerateResume = async () => {
    if (!application?.resume_id || !application?.job_id) return;
    setResumeGenerating(true);
    setResumeGenerateError(null);
    setGeneratedResumeId(null);
    try {
      const result = await generateResume({
        base_resume_id: application.resume_id,
        job_id: application.job_id,
        template_id: selectedTemplate,
        output_formats: ['pdf', 'docx'],
      });
      setGeneratedResumeId(result.id);
    } catch (err) {
      setResumeGenerateError(err instanceof Error ? err.message : 'Failed to generate resume. Please try again.');
    } finally {
      setResumeGenerating(false);
    }
  };

  const handleResumeModalClose = () => {
    setResumeModalOpen(false);
    setResumeGenerateError(null);
    setGeneratedResumeId(null);
  };

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

      {generateError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {generateError}
        </Alert>
      )}

      <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        {application.cover_letter_path ? (
          <>
            <Button variant="contained" onClick={() => downloadCoverLetter(application.id)}>
              Download Cover Letter
            </Button>
            <Button
              variant="outlined"
              disabled={generating}
              onClick={async () => {
                setGenerating(true);
                setGenerateError(null);
                try {
                  await generateCoverLetterMutation.mutateAsync(application.id);
                } catch (err) {
                  setGenerateError(err instanceof Error ? err.message : 'Failed to regenerate cover letter');
                } finally {
                  setGenerating(false);
                }
              }}
              startIcon={generating ? <CircularProgress size={16} /> : undefined}
            >
              {generating ? 'Generating...' : 'Regenerate'}
            </Button>
          </>
        ) : (
          <Button
            variant="contained"
            disabled={generating}
            onClick={async () => {
              setGenerating(true);
              setGenerateError(null);
              try {
                await generateCoverLetterMutation.mutateAsync(application.id);
              } catch (err) {
                setGenerateError(err instanceof Error ? err.message : 'Failed to generate cover letter');
              } finally {
                setGenerating(false);
              }
            }}
            startIcon={generating ? <CircularProgress size={16} /> : undefined}
          >
            {generating ? 'Generating...' : 'Generate Cover Letter'}
          </Button>
        )}

        <Button
          variant="outlined"
          onClick={() => {
            setResumeModalOpen(true);
            setGeneratedResumeId(null);
            setResumeGenerateError(null);
          }}
        >
          Generate Tailored Resume
        </Button>
      </Box>

      {application.notes && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Notes: {application.notes}
        </Typography>
      )}

      <Dialog open={resumeModalOpen} onClose={handleResumeModalClose} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Tailored Resume</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {jobLoading ? 'Loading job details...' : `${jobData?.title ?? 'Job'}${jobData?.company ? ` at ${jobData.company}` : ''}`}
          </Typography>

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Select Template
          </Typography>
          <TemplateSelector selectedId={selectedTemplate} onSelect={setSelectedTemplate} />

          {(resumeGenerateError || generateError) && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {resumeGenerateError ?? generateError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', gap: 1, px: 3, pb: 2 }}>
          {resumeGenerating ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', py: 1 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary">
                Tailoring your resume for this role...
              </Typography>
            </Box>
          ) : generatedResumeId ? (
            <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
              <Button
                variant="contained"
                href={getDownloadUrl(generatedResumeId, 'pdf')}
                sx={{ flex: 1 }}
              >
                Download PDF
              </Button>
              <Button
                variant="outlined"
                href={getDownloadUrl(generatedResumeId, 'docx')}
                sx={{ flex: 1 }}
              >
                Download DOCX
              </Button>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', gap: 1, width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={handleResumeModalClose} disabled={resumeGenerating}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleGenerateResume}
                  disabled={!application.resume_id || !application.job_id}
                >
                  Generate
                </Button>
              </Box>
              {(!application.resume_id || !application.job_id) && (
                <Typography variant="caption" color="text.secondary">
                  A base resume and job are required to generate a tailored resume.
                </Typography>
              )}
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ApplicationDetailPage;
