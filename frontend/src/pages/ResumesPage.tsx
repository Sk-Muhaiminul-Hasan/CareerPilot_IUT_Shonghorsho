import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SaveIcon from '@mui/icons-material/Save';

import ResumeUpload from '@/components/resumes/ResumeUpload';
import TemplateSelector from '@/components/resumes/TemplateSelector';
import LoadingState from '@/components/common/LoadingState';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { useResumeContent, useResumes, useUpdateResumeContent } from '@/hooks/useResumes';
import { getDownloadUrl } from '@/services/resumeService';
import { useChatStore } from '@/store/useChatStore';
import { useAppStore } from '@/store/useAppStore';
import { DEMO_CV_TEXT } from '@/data/demoProfile';

function ResumesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
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

  const handleTemplateSelect = useCallback((templateId: string) => {
    setSelectedTemplate(templateId);
  }, []);

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

  const useInCopilot = (resumeId: string) => {
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
          <Button variant="outlined" startIcon={<DescriptionIcon />} onClick={selectDemo}>
            Open demo CV
          </Button>
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
                onClick={() => useInCopilot(isDemoSelected ? 'default_user' : selectedResumeId ?? '')}
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

        <Box sx={{ mt: 4, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Resume Templates
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a template for generating tailored resumes. Currently selected:{' '}
            <strong>{selectedTemplate}</strong>
          </Typography>
          <TemplateSelector selectedId={selectedTemplate} onSelect={handleTemplateSelect} />
        </Box>

        <Divider sx={{ my: 4 }} />

        <Typography variant="h6" gutterBottom>
          Your Resumes
        </Typography>

        {isLoading && <LoadingState message="Loading resumes..." minHeight={200} />}

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
          <Grid container spacing={2}>
            {resumeData.items.map((resume) => (
              <Grid item xs={12} sm={6} md={4} key={resume.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <DescriptionIcon color="primary" />
                      <Typography variant="subtitle1" fontWeight={600} noWrap>
                        {resume.name}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                      <Chip label={resume.type} size="small" variant="outlined" />
                      <Chip label={resume.template_id} size="small" variant="outlined" />
                    </Box>

                    {resume.ats_score != null && (
                      <Typography variant="body2" color="text.secondary">
                        ATS Score: {Math.round(resume.ats_score * 100)}%
                      </Typography>
                    )}

                    <Typography variant="caption" color="text.secondary" display="block">
                      Created: {new Date(resume.created_at).toLocaleDateString()}
                    </Typography>
                  </CardContent>

                  <CardActions sx={{ px: 2, pb: 2, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={() => selectResume(resume.id)}
                    >
                      View/Edit
                    </Button>
                    <Button
                      size="small"
                      startIcon={<SmartToyIcon />}
                      onClick={() => useInCopilot(resume.id)}
                    >
                      Copilot
                    </Button>
                    {resume.has_pdf && (
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        href={getDownloadUrl(resume.id, 'pdf')}
                      >
                        PDF
                      </Button>
                    )}
                    {resume.has_docx && (
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        href={getDownloadUrl(resume.id, 'docx')}
                      >
                        DOCX
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </ErrorBoundary>
  );
}

export default ResumesPage;
