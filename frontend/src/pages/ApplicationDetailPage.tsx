import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import AIAnalyzing from '@/components/common/AIAnalyzing';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { useJob } from '@/hooks/useJobs';
import { useApplication, useGenerateCoverLetter, useUpdateApplicationStatus } from '@/hooks/useApplications';
import { useSharedWebSocket } from '@/contexts/SharedWebSocketProvider';
import { downloadCoverLetter } from '@/services/applicationService';
import { generateResume, getResumeRaw } from '@/services/resumeService';
import { useQueryClient } from '@tanstack/react-query';
import { convertMarkdownToHtml } from '@/utils/artifactFiles';
import type { ApiError } from '@/types/api';
import type { ApplicationStatusUpdate } from '@/types/application';
import AINotConfiguredBanner from '@/components/AINotConfiguredBanner';
import type { Application } from '@/types/application';

function isAINotConfigured(error: unknown): boolean {
  if (!error) return false;
  const apiError = error as Partial<ApiError>;
  if (apiError.status_code !== 428) return false;
  try {
    const detail = typeof apiError.detail === 'string' ? JSON.parse(apiError.detail) : apiError.detail;
    return (detail as Record<string, unknown>)?.code === 'ai_not_configured';
  } catch {
    return false;
  }
}

const handleClientPdfDownload = (name: string, contentText: string) => {
  const container = document.createElement('div');
  container.style.padding = '35px';
  container.style.color = '#1e293b';
  container.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif";
  container.style.lineHeight = '1.5';
  container.style.backgroundColor = '#ffffff';

  const htmlContent = convertMarkdownToHtml(contentText);

  container.innerHTML = `
    <div style="font-family: 'Inter', sans-serif;">
      <h1 style="text-align: center; color: #0f172a; margin-top: 0; margin-bottom: 15px; font-size: 24px; font-weight: 800; text-transform: uppercase;">${name}</h1>
      <div style="margin-top: 15px;">
        ${htmlContent}
      </div>
    </div>
  `;

  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
  script.onload = () => {
    const opt = {
      margin:       [12, 12, 12, 12],
      filename:     `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_resume.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    // @ts-ignore
    window.html2pdf().from(container).set(opt).save();
  };
  document.head.appendChild(script);
};

const handleDownloadMarkdown = (name: string, contentText: string) => {
  const blob = new Blob([contentText], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_resume.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

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

const USER_VISIBLE_STATUSES = ['applied', 'interview', 'offer', 'rejected'] as const;

interface StatusSelectorProps {
  application: Application;
  onUpdateStatus?: (appId: string, status: string) => void;
}

function StatusSelector({ application, onUpdateStatus }: StatusSelectorProps) {
  if (!onUpdateStatus) return null;

  const handleChange = (event: { target: { value: unknown } }) => {
    const status = event.target.value as string;
    onUpdateStatus(application.id, status);
  };

  return (
    <FormControl size="small" sx={{ minWidth: 140 }}>
      <InputLabel id={`detail-status-${application.id}`} shrink>
        Status
      </InputLabel>
      <Select
        labelId={`detail-status-${application.id}`}
        label="Status"
        value={application.status}
        onChange={handleChange}
      >
        {USER_VISIBLE_STATUSES.map((status) => (
          <MenuItem key={status} value={status}>
            {STATUS_CONFIG[status]?.label ?? status}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

interface TimelineEntry {
  label: string;
  date: string;
}

function formatCardDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface ApplicationTimelineProps {
  application: Application;
}

function ApplicationTimeline({ application }: ApplicationTimelineProps) {
  const entries: TimelineEntry[] = [
    { label: 'Created', date: application.created_at },
  ];
  if (application.applied_at) {
    entries.push({ label: 'Applied', date: application.applied_at });
  }
  entries.push({ label: 'Current Status', date: application.updated_at });

  return (
    <Box sx={{ my: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Application Timeline
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {entries.map((entry, index) => (
          <Box key={entry.label} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: index === entries.length - 1 ? 'primary.main' : 'grey.400',
                flexShrink: 0,
              }}
            />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                {entry.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatCardDate(entry.date)}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function ApplicationDetailPage() {
  const { appId } = useParams<{ appId: string }>();
  const queryClient = useQueryClient();
  const { onScore } = useSharedWebSocket();

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [aiNotConfigured, setAINotConfigured] = useState(false);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const [resumeGenerating, setResumeGenerating] = useState(false);
  const [resumeGenerateError, setResumeGenerateError] = useState<string | null>(null);
  const selectedTemplate = 'modern';
  const [generatedResumeId, setGeneratedResumeId] = useState<string | null>(null);

  const { data: appData, isLoading: appLoading, isError: appError } = useApplication(appId);
  const generateCoverLetterMutation = useGenerateCoverLetter();
  const updateStatusMutation = useUpdateApplicationStatus();

  const application: Application | undefined = appData;
  const jobId = application?.job_id ?? '';
  const { data: jobData, isLoading: jobLoading } = useJob(jobId || undefined);

  const handleUpdateStatus = useCallback(
    (appId: string, status: string) => {
      updateStatusMutation.mutate(
        { appId, update: { status } as ApplicationStatusUpdate },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['applications', 'detail', appId] });
          },
        },
      );
    },
    [updateStatusMutation, queryClient],
  );

  useEffect(() => {
    if (!appId) return;
    const unsubscribe = onScore((data: { application_id: string; ats_score: number | null; reasoning: unknown }) => {
      if (data.application_id === appId) {
        void queryClient.invalidateQueries({ queryKey: ['applications', 'detail', appId] });
      }
    });
    return unsubscribe;
  }, [appId, queryClient, onScore]);

  const handleGenerateResume = useCallback(async () => {
    if (!application?.resume_id || !application?.job_id) return;
    setResumeGenerating(true);
    setResumeGenerateError(null);
    setGeneratedResumeId(null);
    try {
      const result = await generateResume({
        base_resume_id: application.resume_id,
        job_id: application.job_id,
        template_id: selectedTemplate,
        output_formats: ['pdf'],
      });
      setGeneratedResumeId(result.id);
    } catch (err) {
      setResumeGenerateError(err instanceof Error ? err.message : 'Failed to generate resume. Please try again.');
    } finally {
      setResumeGenerating(false);
    }
  }, [application, selectedTemplate]);

  const handlePdfDownload = useCallback(async () => {
    if (!generatedResumeId) return;
    try {
      const resRaw = await getResumeRaw(generatedResumeId);
      if (resRaw?.raw_text) {
        handleClientPdfDownload(resRaw.filename.replace(/\.[^/.]+$/, "") || "Tailored_Resume", resRaw.raw_text);
      }
    } catch (err) {
      console.error(err);
    }
  }, [generatedResumeId]);

  const handleMarkdownDownload = useCallback(async () => {
    if (!generatedResumeId) return;
    try {
      const resRaw = await getResumeRaw(generatedResumeId);
      if (resRaw?.raw_text) {
        handleDownloadMarkdown(resRaw.filename.replace(/\.[^/.]+$/, "") || "Tailored_Resume", resRaw.raw_text);
      }
    } catch (err) {
      console.error(err);
    }
  }, [generatedResumeId]);

  const handleResumeModalClose = useCallback(() => {
    setResumeModalOpen(false);
    setResumeGenerateError(null);
    setGeneratedResumeId(null);
  }, []);

  const detailTitle = jobData?.title ?? application?.job_title ?? 'Application';
  const headerSubtitle = `${detailTitle}${jobData?.company ?? application?.job_company ? ` @ ${jobData?.company ?? application?.job_company}` : ''} — ${formatCardDate(application?.created_at)}`;
  const atsScore = application?.ats_score ?? 0;
  const statusConf = STATUS_CONFIG[application?.status ?? ''] ?? { label: application?.status ?? '', color: 'default' as const };

  if (appLoading) {
    return (
      <AIAnalyzing
        messages={[
          'Loading your application...',
          'Fetching AI analysis...',
          'Preparing review data...',
        ]}
        minHeight={300}
      />
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


  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {detailTitle}
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2 }}>
        {headerSubtitle}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip label={APPLY_MODE_LABELS[application.apply_mode] ?? application.apply_mode} variant="outlined" />
        <Chip label={statusConf.label} color={statusConf.color} size="small" />
        <StatusSelector application={application} onUpdateStatus={handleUpdateStatus} />
      </Box>
      <ApplicationTimeline application={application} />
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

      {jobLoading ? (
        <Box sx={{ my: 2 }}>
          <Skeleton width={180} height={20} />
        </Box>
      ) : (
        <Box sx={{ my: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Job Description</Typography>
          <Box
            sx={{
              maxHeight: 260,
              overflowY: 'auto',
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              p: 1.5,
              mb: 3,
              backgroundColor: '#f8f9ff',
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {jobData?.description || 'No description available.'}
            </Typography>
          </Box>
        </Box>
      )}

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          ATS Score
        </Typography>
        {application.ats_score === null || application.ats_score === undefined ? (
          <AIAnalyzing
            messages={[
              'Reading your resume...',
              'Matching with job requirements...',
              'Generating insights...',
              'Calculating ATS score...',
            ]}
            minHeight={120}
          />
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
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {application.reasoning === null || application.reasoning === undefined
                  ? 'Match analysis will appear after AI scoring completes.'
                  : ''}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {application.reasoning === null || application.reasoning === undefined ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Match analysis will appear after AI scoring completes.
        </Typography>
      ) : (
        (() => {
          const reasoning = application.reasoning as { matches?: string[]; gaps?: string[] };
          return (
            <>
              <Typography variant="subtitle2" color="success.main" sx={{ mb: 1 }}>
                Why you match
              </Typography>
              {reasoning.matches?.length ? (
                reasoning.matches.map((match, i) => (
                  <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
                    ✓ {match}
                  </Typography>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No match data available
                </Typography>
              )}
              <Typography variant="subtitle2" color="error.main" sx={{ mt: 2, mb: 1 }}>
                Gaps
              </Typography>
              {reasoning.gaps?.length ? (
                reasoning.gaps.map((gap, i) => (
                  <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
                    ✗ {gap}
                  </Typography>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No gap data available
                </Typography>
              )}
            </>
          );
        })()
      )}

        {generateError && !aiNotConfigured && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {generateError}
          </Alert>
        )}

        {aiNotConfigured && (
          <AINotConfiguredBanner message="Configure your AI model to generate cover letters." />
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
                  setAINotConfigured(false);
                  try {
                    await generateCoverLetterMutation.mutateAsync(application.id);
                  } catch (err) {
                    if (isAINotConfigured(err)) {
                      setAINotConfigured(true);
                    } else {
                      setGenerateError(err instanceof Error ? err.message : 'Failed to regenerate cover letter');
                    }
                  } finally {
                    setGenerating(false);
                  }
                }}
              startIcon={generating ? <AIAnalyzing inline messages={['Generating...', 'Writing cover letter...', 'Almost done...']} /> : undefined}
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
                setAINotConfigured(false);
                try {
                  await generateCoverLetterMutation.mutateAsync(application.id);
                } catch (err) {
                  if (isAINotConfigured(err)) {
                    setAINotConfigured(true);
                  } else {
                    setGenerateError(err instanceof Error ? err.message : 'Failed to generate cover letter');
                  }
                } finally {
                  setGenerating(false);
                }
              }}
              startIcon={generating ? <AIAnalyzing inline messages={['Generating...', 'Writing cover letter...', 'Almost done...']} /> : undefined}
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

          {(resumeGenerateError || generateError) && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {resumeGenerateError ?? generateError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', gap: 1, px: 3, pb: 2 }}>
          {resumeGenerating ? (
            <AIAnalyzing
              messages={[
                'Tailoring your resume...',
                'Matching skills to the role...',
                'Formatting document...',
                'Almost ready...',
              ]}
              minHeight={100}
            />
          ) : generatedResumeId ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', alignItems: 'center' }}>
              <Alert severity="success" sx={{ width: '100%' }}>
                Tailored resume generated successfully! It is saved to the **Generated** section of the Resume Manager.
              </Alert>
              <Box sx={{ display: 'flex', gap: 1.5, width: '100%' }}>
                <Button
                  variant="contained"
                  onClick={handlePdfDownload}
                  sx={{
                    flex: 1,
                    py: 1.2,
                    fontWeight: 600,
                    textTransform: 'none',
                    borderRadius: 2,
                    backgroundColor: '#0f172a',
                    '&:hover': { backgroundColor: '#1e293b' },
                  }}
                >
                  Download PDF
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleMarkdownDownload}
                  sx={{
                    flex: 1,
                    py: 1.2,
                    fontWeight: 600,
                    textTransform: 'none',
                    borderRadius: 2,
                    borderColor: '#0f172a',
                    color: '#0f172a',
                    '&:hover': { borderColor: '#1e293b', backgroundColor: '#f8fafc' },
                  }}
                >
                  Download Markdown
                </Button>
              </Box>
              <Button
                variant="text"
                onClick={() => {
                  window.location.hash = '/resumes';
                  handleResumeModalClose();
                }}
                sx={{ textTransform: 'none', color: '#64748b', '&:hover': { color: '#0f172a' } }}
              >
                Go to Resume Manager
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
