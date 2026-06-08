import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SaveIcon from '@mui/icons-material/Save';

import ResumeUpload from '@/components/resumes/ResumeUpload';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { useResumeContent, useResumes, useUpdateResumeContent } from '@/hooks/useResumes';
import { downloadResume } from '@/services/resumeService';
import { useChatStore } from '@/store/useChatStore';
import { useAppStore } from '@/store/useAppStore';
import { DEMO_CV_TEXT } from '@/data/demoProfile';

function ResumesPage() {
  const navigate = useNavigate();
  const [draftContent, setDraftContent] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: resumeData, isLoading } = useResumes();
  const selectedResumeId = searchParams.get('resumeId');
  const isDemoSelected = searchParams.get('demo') === '1';
  const { data: selectedContent, isLoading: contentLoading } = useResumeContent(
    isDemoSelected ? null : selectedResumeId,
  );
  const updateContent = useUpdateResumeContent();
  const openChatWithResume = useChatStore((s) => s.openChatWithResume);
  const showNotification = useAppStore((s) => s.showNotification);

  useEffect(() => {
    if (isDemoSelected) {
      setDraftContent(DEMO_CV_TEXT);
    } else if (selectedContent) {
      setDraftContent(selectedContent.content_text);
    }
  }, [isDemoSelected, selectedContent]);

  const selectResume = (resumeId: string) => {
    setSearchParams({ resumeId });
  };

  const selectDemo = () => {
    setSearchParams({ demo: '1' });
  };

  const handleUseInCopilot = (resumeId: string) => {
    openChatWithResume(resumeId);
    showNotification(
      resumeId === 'default_user' ? 'Demo CV attached to Copilot.' : 'CV attached to Copilot.',
      'success',
    );
  };

  const saveSelectedResume = async () => {
    if (!selectedResumeId || isDemoSelected) return;
    await updateContent.mutateAsync({ resumeId: selectedResumeId, contentText: draftContent });
    showNotification('Resume text saved.', 'success');
  };

  const handleDownload = async (resumeId: string, format: 'pdf' | 'docx') => {
    await downloadResume(resumeId, format);
  };

  return (
    <ErrorBoundary>
      <Box>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Profile & CV Workspace
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Upload a CV, review the parsed text, make quick edits, and attach it to Copilot.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              onClick={() => navigate('/jobs')}
            >
              Generate Tailored Resume
            </Button>
            <Button variant="outlined" startIcon={<DescriptionIcon />} onClick={selectDemo}>
              Open demo CV
            </Button>
          </Stack>
        </Stack>

        <ResumeUpload onUploaded={selectResume} />

        {(selectedResumeId || isDemoSelected) && (
          <Paper variant="outlined" sx={{ mt: 3, p: 2, borderRadius: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 1.5 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">
                  {isDemoSelected ? 'Demo CV context' : selectedContent?.name ?? 'Resume context'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isDemoSelected
                    ? 'This is placeholder context so Pillar 3 can be tested before Pillar 2 finishes full CV intelligence.'
                    : 'Simple parsed text editor. Pillar 2 can replace this with a richer structured editor later.'}
                </Typography>
              </Box>
              <Button
                startIcon={<SmartToyIcon />}
                variant="contained"
                onClick={() => handleUseInCopilot(isDemoSelected ? 'default_user' : selectedResumeId ?? '')}
              >
                Use in Copilot
              </Button>
              {!isDemoSelected && (
                <Button
                  startIcon={<SaveIcon />}
                  onClick={saveSelectedResume}
                  disabled={!selectedResumeId || contentLoading || updateContent.isPending}
                >
                  Save
                </Button>
              )}
            </Stack>
            <TextField
              fullWidth
              multiline
              minRows={10}
              maxRows={18}
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
              disabled={isDemoSelected}
              placeholder="Parsed resume text will appear here after upload."
            />
          </Paper>
        )}

        <Divider sx={{ my: 4 }} />

        <Typography variant="h6" gutterBottom>
          Your Resumes
        </Typography>

        {isLoading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3].map((i) => (
              <Box
                key={i}
                sx={{
                  width: '100%',
                  height: 90,
                  borderRadius: 2,
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  px: 2,
                  backgroundColor: '#ffffff',
                  overflow: 'hidden',
                }}
              >
                <Skeleton variant="rounded" width={44} height={44} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="45%" sx={{ fontSize: '1rem' }} />
                  <Skeleton variant="text" width="30%" sx={{ fontSize: '0.75rem' }} />
                </Box>
                <Skeleton variant="rounded" width={180} height={32} sx={{ borderRadius: 1.5 }} />
              </Box>
            ))}
          </Box>
        )}

        {!isLoading && resumeData && resumeData.items.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <DescriptionIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No resumes yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upload your first resume to get started with ATS optimization.
            </Typography>
          </Box>
        )}

        {resumeData && resumeData.items.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {resumeData.items.map((resume) => (
              <Box
                key={resume.id}
                sx={{
                  width: '100%',
                  minHeight: 90,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: selectedResumeId === resume.id ? '#004ac6' : '#e2e8f0',
                  backgroundColor: selectedResumeId === resume.id ? '#f0f4ff' : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  px: 2.5,
                  py: 1.5,
                  transition: 'border-color 0.15s, background-color 0.15s',
                  '&:hover': {
                    borderColor: '#004ac6',
                    backgroundColor: '#f8faff',
                  },
                }}
              >
                {/* Icon */}
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 1.5,
                    backgroundColor: '#eff4ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <DescriptionIcon sx={{ color: '#004ac6', fontSize: 22 }} />
                </Box>

                {/* Name + metadata */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, color: '#0b1c30', lineHeight: 1.3 }}
                    noWrap
                  >
                    {resume.name}
                  </Typography>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                    <Chip label={resume.type} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.68rem' }} />
                    <Chip label={resume.template_id} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.68rem' }} />
                    {resume.ats_score != null && (
                      <Chip
                        label={`ATS ${Math.round(resume.ats_score * 100)}%`}
                        size="small"
                        color={resume.ats_score >= 0.75 ? 'success' : resume.ats_score >= 0.5 ? 'warning' : 'default'}
                        sx={{ height: 20, fontSize: '0.68rem' }}
                      />
                    )}
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                      {new Date(resume.created_at).toLocaleDateString()}
                    </Typography>
                  </Stack>
                </Box>

                {/* Actions */}
                <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                  <Tooltip title="View / Edit">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<VisibilityIcon />}
                      onClick={() => selectResume(resume.id)}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      View
                    </Button>
                  </Tooltip>
                  <Tooltip title="Attach to Copilot">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SmartToyIcon />}
                      onClick={() => handleUseInCopilot(resume.id)}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      Copilot
                    </Button>
                  </Tooltip>
                  {resume.has_pdf && (
                    <Tooltip title="Download PDF">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleDownload(resume.id, 'pdf')}
                      >
                        PDF
                      </Button>
                    </Tooltip>
                  )}
                  {resume.has_docx && (
                    <Tooltip title="Download DOCX">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleDownload(resume.id, 'docx')}
                      >
                        DOCX
                      </Button>
                    </Tooltip>
                  )}
                </Stack>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </ErrorBoundary>
  );
}

export default ResumesPage;
