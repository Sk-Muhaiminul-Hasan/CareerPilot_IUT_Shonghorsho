import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Chip,
  Divider,
  TextField,
  Stack,
  Paper,
  Skeleton,
  Tooltip,
  Dialog,
  DialogContent,
  DialogActions,
  IconButton,
  Tabs,
  Tab,
  Card,
  CardContent,
  CircularProgress,
} from '@mui/material';

import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import ResumeUpload from '@/components/resumes/ResumeUpload';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import {
  useResumeRaw,
  useUpdateResumeRaw,
  useUploadedResumes,
  useTailoredResumes,
  useDeleteResume,
} from '@/hooks/useResumes';
import { getResumeRaw } from '@/services/resumeService';
import { useChatStore } from '@/store/useChatStore';
import { useAppStore } from '@/store/useAppStore';
import ReactMarkdown from 'react-markdown';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ParsedResume {
  name: string;
  summary: string;
  experience: string;
  education: string;
  skills: string;
  certifications: string;
  other: string;
}

// ─── Bi-directional text parser/compiler helpers ───────────────────────────────

/** Splits raw resume markdown text into structured fields based on headers. */
export function parseResumeText(name: string, text: string): ParsedResume {
  const sections: ParsedResume = {
    name: name || '',
    summary: '',
    experience: '',
    education: '',
    skills: '',
    certifications: '',
    other: '',
  };

  if (!text) return sections;

  const lines = text.split(/\r?\n/);
  let currentSection: keyof ParsedResume = 'other';
  let currentLines: string[] = [];

  const commitSection = () => {
    const val = currentLines.join('\n').trim();
    if (val) {
      if (sections[currentSection]) {
        sections[currentSection] = sections[currentSection] + '\n\n' + val;
      } else {
        sections[currentSection] = val;
      }
    }
    currentLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const isHeader = line.startsWith('#');

    if (isHeader) {
      commitSection();
      const cleanHeader = trimmed.replace(/^[#\s-*]+|[#\s:*]+$/g, '').toLowerCase();

      if (
        cleanHeader === 'summary' ||
        cleanHeader.includes('professional summary') ||
        cleanHeader === 'profile' ||
        cleanHeader.includes('about me')
      ) {
        currentSection = 'summary';
      } else if (
        cleanHeader.includes('experience') ||
        cleanHeader.includes('history') ||
        cleanHeader.includes('work') ||
        cleanHeader.includes('employment')
      ) {
        currentSection = 'experience';
      } else if (
        cleanHeader.includes('education') ||
        cleanHeader.includes('academic') ||
        cleanHeader.includes('credentials')
      ) {
        currentSection = 'education';
      } else if (
        cleanHeader.includes('skills') ||
        cleanHeader.includes('technologies') ||
        cleanHeader.includes('expertise')
      ) {
        currentSection = 'skills';
      } else if (
        cleanHeader.includes('certifications') ||
        cleanHeader.includes('certificates') ||
        cleanHeader.includes('achievements') ||
        cleanHeader.includes('awards') ||
        cleanHeader.includes('projects')
      ) {
        currentSection = 'certifications';
      } else {
        currentSection = 'other';
        currentLines.push(line);
      }
    } else {
      currentLines.push(line);
    }
  }

  commitSection();
  return sections;
}

/** Compiles structured fields back into formatted markdown text. */
export function compileResumeText(sections: ParsedResume): string {
  const parts: string[] = [];

  if (sections.other?.trim()) {
    parts.push(sections.other.trim());
  }
  if (sections.summary?.trim()) {
    parts.push(`## Professional Summary\n${sections.summary.trim()}`);
  }
  if (sections.experience?.trim()) {
    parts.push(`## Professional Experience\n${sections.experience.trim()}`);
  }
  if (sections.education?.trim()) {
    parts.push(`## Education\n${sections.education.trim()}`);
  }
  if (sections.skills?.trim()) {
    parts.push(`## Skills\n${sections.skills.trim()}`);
  }
  if (sections.certifications?.trim()) {
    parts.push(`## Certifications & Achievements\n${sections.certifications.trim()}`);
  }

  return parts.join('\n\n');
}

// ─── Dynamic CDN Loader for client-side PDF downloads ───────────────────────────

const convertMarkdownToHtml = (markdown: string): string => {
  if (!markdown) return '';

  let html = markdown;
  html = html.replace(/\r/g, '');

  // Strip or replace simple markdown styles
  // Bold text (**text**)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Headings (#, ##, ###)
  html = html.replace(/^# (.*?)$/gm, '<h1 style="color: #0f172a; border-bottom: 2px solid #004ac6; padding-bottom: 6px; margin-top: 24px; margin-bottom: 12px; font-size: 22px; font-weight: 800; font-family: \'Inter\', sans-serif;">$1</h1>');
  html = html.replace(/^## (.*?)$/gm, '<h2 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px; margin-bottom: 10px; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-family: \'Inter\', sans-serif;">$1</h2>');
  html = html.replace(/^### (.*?)$/gm, '<h3 style="color: #334155; margin-top: 14px; margin-bottom: 6px; font-size: 13px; font-weight: 600; font-family: \'Inter\', sans-serif;">$1</h3>');

  // Parse lines to group bullet points
  const lines = html.split('\n');
  let inList = false;
  const processedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const content = trimmed.substring(2).trim();
      if (!inList) {
        processedLines.push('<ul style="margin-top: 4px; margin-bottom: 10px; padding-left: 20px; list-style-type: disc;">');
        inList = true;
      }
      processedLines.push(`<li style="margin-bottom: 4px; color: #334155; font-size: 12px; font-family: \'Inter\', sans-serif; line-height: 1.4;">${content}</li>`);
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      if (trimmed) {
        processedLines.push(`<p style="margin-top: 0; margin-bottom: 10px; color: #475569; font-size: 12px; font-family: \'Inter\', sans-serif; line-height: 1.5;">${line}</p>`);
      } else {
        processedLines.push('<div style="height: 6px;"></div>');
      }
    }
  }
  if (inList) {
    processedLines.push('</ul>');
  }

  return processedLines.join('\n');
};

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

// ─── Skeletons for cards ───────────────────────────────────────────────────────

function ResumeSkeleton() {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <Skeleton variant="circular" width={40} height={40} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" height={24} />
          <Skeleton variant="text" width="35%" height={16} />
        </Box>
      </Stack>
      <Skeleton variant="rounded" height={60} sx={{ borderRadius: 1.5, mb: 2, flex: 1 }} />
      <Stack direction="row" spacing={1} sx={{ mt: 'auto' }}>
        <Skeleton variant="rounded" width="45%" height={32} />
        <Skeleton variant="rounded" width="45%" height={32} />
      </Stack>
    </Card>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────

function ResumesPage() {
  const navigate = useNavigate();
  const showNotification = useAppStore((s) => s.showNotification);
  const openChatWithResume = useChatStore((s) => s.openChatWithResume);
  const userProfileId = useChatStore((s) => s.userProfileId);

  // Queries
  const { data: uploadedResumes, isLoading: isUploadedLoading } = useUploadedResumes();
  const { data: tailoredResumes, isLoading: isTailoredLoading } = useTailoredResumes();

  // Mutations
  const deleteResumeMutation = useDeleteResume();

  // Navigation / Tabs State
  const [activeTab, setActiveTab] = useState<'uploads' | 'generated'>('uploads');

  // Modals Toggles & Content Cache
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // VIEW MODAL STATE
  const [viewingResumeId, setViewingResumeId] = useState<string | null>(null);
  const { data: viewingContent, isLoading: isViewingContentLoading } = useResumeRaw(viewingResumeId);
  const viewingResume =
    uploadedResumes?.items.find((r) => r.id === viewingResumeId) ||
    tailoredResumes?.items.find((r) => r.id === viewingResumeId);

  // EDIT MODAL STATE
  const [editingResumeId, setEditingResumeId] = useState<string | null>(null);
  const { data: editingContent, isLoading: isEditingContentLoading } = useResumeRaw(editingResumeId);
  const editingResumeObj =
    uploadedResumes?.items.find((r) => r.id === editingResumeId) ||
    tailoredResumes?.items.find((r) => r.id === editingResumeId);

  const [editedText, setEditedText] = useState('');
  const updateResumeRawMutation = useUpdateResumeRaw();

  // DELETE CONFIRM STATE
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const resumeToDelete =
    uploadedResumes?.items.find((r) => r.id === deleteConfirmId) ||
    tailoredResumes?.items.find((r) => r.id === deleteConfirmId);

  // Effect to load raw resume content once retrieved for editing
  useEffect(() => {
    if (editingContent && editingResumeId && editingResumeObj) {
      setEditedText(editingContent.raw_text || '');
    }
  }, [editingContent, editingResumeId, editingResumeObj]);

  const handleUseInCopilot = (resumeId: string) => {
    openChatWithResume(resumeId);
    showNotification('CV context attached to Copilot.', 'success');
  };

  const handleSaveEditedResume = async () => {
    if (!editingResumeObj || !editingResumeId) return;

    try {
      await updateResumeRawMutation.mutateAsync({
        resumeId: editingResumeId,
        rawText: editedText,
      });

      showNotification('Resume successfully saved!', 'success');
      setEditingResumeId(null);
    } catch (error) {
      showNotification('Failed to save resume. Please try again.', 'error');
    }
  };

  const handleDeleteResume = async () => {
    if (!deleteConfirmId) return;

    try {
      await deleteResumeMutation.mutateAsync(deleteConfirmId);
      showNotification('Resume deleted successfully.', 'success');
      setDeleteConfirmId(null);
    } catch (error) {
      showNotification('Failed to delete resume.', 'error');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification('Content copied to clipboard!', 'success');
  };

  const currentItems = activeTab === 'uploads' ? uploadedResumes?.items : tailoredResumes?.items;
  const isListLoading = activeTab === 'uploads' ? isUploadedLoading : isTailoredLoading;

  return (
    <ErrorBoundary>
      <Box sx={{ color: 'text.primary', maxWidth: '1200px', mx: 'auto', px: { xs: 1, sm: 2 } }}>
        
        {/* Page Header */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} justifyContent="space-between" sx={{ mb: 4.5 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#0b1c30', letterSpacing: -0.75, mb: 1 }}>
              Profile & CV Workspace
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '650px', lineHeight: 1.5 }}>
              Upload your base CV, review and live-edit sections, and manage tailored CVs compiled specifically for your target job listings.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={() => setIsUploadOpen(true)}
              sx={{
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #004ac6 0%, #002d8c 100%)',
                boxShadow: '0 4px 14px rgba(0, 74, 198, 0.25)',
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
                py: 1,
                '&:hover': {
                  background: 'linear-gradient(135deg, #003db3 0%, #00216b 100%)',
                  boxShadow: '0 6px 20px rgba(0, 74, 198, 0.35)',
                }
              }}
            >
              Upload Resume
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/jobs')}
              sx={{
                borderRadius: '10px',
                borderColor: '#e2e8f0',
                color: '#475569',
                textTransform: 'none',
                fontWeight: 600,
                px: 2.5,
                py: 1,
                '&:hover': {
                  borderColor: '#cbd5e1',
                  backgroundColor: '#f8fafc'
                }
              }}
            >
              Tailor in Jobs
            </Button>
          </Stack>
        </Stack>

        {/* Tab Controls & Workspace Sections */}
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 4 }}>
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            sx={{
              '& .MuiTabs-indicator': {
                height: 3,
                backgroundColor: '#004ac6',
                borderRadius: '3px 3px 0 0',
              },
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '1rem',
                color: '#64748b',
                px: 1,
                pb: 1.5,
                mr: 3,
                minWidth: 0,
                transition: 'color 0.2s',
                '&.Mui-selected': {
                  color: '#004ac6',
                }
              }
            }}
          >
            <Tab
              value="uploads"
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>Uploads</span>
                  {uploadedResumes && (
                    <Chip
                      label={uploadedResumes.total}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor: activeTab === 'uploads' ? '#eff4ff' : '#f1f5f9',
                        color: activeTab === 'uploads' ? '#004ac6' : '#64748b',
                      }}
                    />
                  )}
                </Stack>
              }
            />
            <Tab
              value="generated"
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>Generated</span>
                  {tailoredResumes && (
                    <Chip
                      label={tailoredResumes.total}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor: activeTab === 'generated' ? '#f5f0ff' : '#f1f5f9',
                        color: activeTab === 'generated' ? '#7c3aed' : '#64748b',
                      }}
                    />
                  )}
                </Stack>
              }
            />
          </Tabs>
        </Box>

        {/* List & Grids of Cards */}
        {isListLoading ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 3,
            }}
          >
            {[1, 2, 3].map((i) => (
              <ResumeSkeleton key={i} />
            ))}
          </Box>
        ) : currentItems && currentItems.length === 0 ? (
          /* Gorgeous Empty State Container */
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              px: 3,
              borderRadius: 4,
              border: '2px dashed #e2e8f0',
              backgroundColor: '#fafbff',
              maxWidth: 600,
              mx: 'auto',
              mt: 2
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: activeTab === 'uploads' ? '#eff4ff' : '#f5f0ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2.5,
                color: activeTab === 'uploads' ? '#004ac6' : '#7c3aed',
              }}
            >
              <DescriptionIcon sx={{ fontSize: 32 }} />
            </Box>
            <Typography variant="h6" sx={{ color: '#0b1c30', fontWeight: 700, mb: 1 }}>
              {activeTab === 'uploads' ? 'No uploaded CVs' : 'No generated documents'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.5 }}>
              {activeTab === 'uploads'
                ? 'Upload your primary resume to activate Copilot profile integration and get highly tailored fit-checks.'
                : 'All AI-generated resumes, optimized CVs, and cover letters from chat or jobs will show up here.'}
            </Typography>
            {activeTab === 'uploads' ? (
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => setIsUploadOpen(true)}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
              >
                Upload CV
              </Button>
            ) : (
              <Button
                variant="outlined"
                onClick={() => navigate('/jobs')}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
              >
                Browse Job Listings
              </Button>
            )}
          </Box>
        ) : (
          /* Cards Grid Layout */
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 3,
            }}
          >
            {currentItems?.map((resume) => {
              const isCopilotActive = userProfileId === resume.id;
              const hasScore = resume.ats_score != null;
              const accentColor = activeTab === 'uploads' ? '#004ac6' : '#7c3aed';
              const lightBg = activeTab === 'uploads' ? '#eff4ff' : '#f5f0ff';

              return (
                <Card
                  key={resume.id}
                  variant="outlined"
                  sx={{
                    borderRadius: 3.5,
                    border: '1px solid',
                    borderColor: isCopilotActive ? accentColor : '#e2e8f0',
                    backgroundColor: isCopilotActive ? (activeTab === 'uploads' ? '#f0f4ff' : '#faf5ff') : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isCopilotActive ? `0 8px 24px rgba(11, 28, 48, 0.06)` : 'none',
                    position: 'relative',
                    height: '100%',
                    '&:hover': {
                      boxShadow: `0 12px 30px rgba(11, 28, 48, 0.1)`,
                      transform: 'translateY(-3px)',
                      borderColor: accentColor,
                    },
                  }}
                >
                  {/* Accent Top Ribbon */}
                  <Box sx={{ height: 4, backgroundColor: accentColor }} />

                  {/* Active Copilot Indicator Badge */}
                  {isCopilotActive && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 14,
                        right: 14,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        backgroundColor: activeTab === 'uploads' ? '#004ac6' : '#7c3aed',
                        color: '#ffffff',
                        px: 1,
                        py: 0.25,
                        borderRadius: '6px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      }}
                    >
                      <CheckCircleIcon sx={{ fontSize: 13, color: '#ffffff' }} />
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: 0.5 }}>ACTIVE</Typography>
                    </Box>
                  )}

                  <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Stack direction="row" spacing={1.75} alignItems="center" sx={{ mb: 2.2 }}>
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 2.5,
                          backgroundColor: lightBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: accentColor,
                          flexShrink: 0,
                        }}
                      >
                        <DescriptionIcon sx={{ fontSize: 22 }} />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1, pr: isCopilotActive ? 5 : 0 }}>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 800, color: '#0b1c30', lineHeight: 1.3 }}
                          noWrap
                        >
                          {resume.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                          Uploaded {new Date(resume.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Typography>
                      </Box>
                    </Stack>

                    {/* Metadata Chips Stack */}
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" gap={0.75} sx={{ mb: 2.5 }}>
                      <Chip
                        label={resume.type === 'base' ? 'UPLOAD' : resume.type.toUpperCase().replace('_', ' ')}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          backgroundColor: lightBg,
                          color: accentColor,
                          border: 'none',
                        }}
                      />
                      <Chip
                        label={`Template: ${resume.template_id}`}
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          fontWeight: 500,
                          color: '#475569',
                          borderColor: '#e2e8f0',
                        }}
                      />
                      {hasScore && (
                        <Chip
                          label={`ATS Match: ${Math.round((resume.ats_score || 0) * 100)}%`}
                          size="small"
                          color={
                            (resume.ats_score || 0) >= 0.8
                              ? 'success'
                              : (resume.ats_score || 0) >= 0.6
                              ? 'warning'
                              : 'error'
                          }
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                          }}
                        />
                      )}
                    </Stack>

                    {/* Quick descriptive text */}
                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1, fontSize: '0.825rem', lineHeight: 1.5, mb: 1.5 }}>
                      {resume.type === 'base'
                        ? 'Primary source of experience, credentials, and structural formatting for profile queries.'
                        : resume.type === 'cover_letter'
                        ? 'AI-generated cover letter tailored for specific job application requirements.'
                        : 'Custom optimization targeting specific keyword scores and alignment profiles.'}
                    </Typography>

                    {/* Primary Control Action Panel */}
                    <Divider sx={{ my: 1.5, borderColor: '#f1f5f9' }} />

                    <Stack direction="row" spacing={1} justifyContent="space-between" sx={{ mt: 'auto' }}>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="View parsed text document">
                          <IconButton
                            size="small"
                            onClick={() => setViewingResumeId(resume.id)}
                            sx={{ color: '#64748b', '&:hover': { color: '#0b1c30', backgroundColor: '#f1f5f9' } }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit structured fields & save as new version">
                          <IconButton
                            size="small"
                            onClick={() => setEditingResumeId(resume.id)}
                            sx={{ color: '#64748b', '&:hover': { color: '#0b1c30', backgroundColor: '#f1f5f9' } }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download PDF">
                          <IconButton
                            size="small"
                            onClick={async () => {
                              try {
                                showNotification('Preparing PDF download...', 'info');
                                const resRaw = await getResumeRaw(resume.id);
                                if (resRaw?.raw_text) {
                                  handleClientPdfDownload(resume.name, resRaw.raw_text);
                                } else {
                                  showNotification('Error extracting document content.', 'error');
                                }
                              } catch (err) {
                                handleClientPdfDownload(resume.name, "## Content\nPrimary resume file compilation content.");
                              }
                            }}
                            sx={{ color: '#64748b', '&:hover': { color: '#0b1c30', backgroundColor: '#f1f5f9' } }}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download Markdown (.md)">
                          <IconButton
                            size="small"
                            onClick={async () => {
                              try {
                                showNotification('Preparing markdown download...', 'info');
                                const resRaw = await getResumeRaw(resume.id);
                                if (resRaw?.raw_text) {
                                  handleDownloadMarkdown(resume.name, resRaw.raw_text);
                                } else {
                                  showNotification('Error extracting document content.', 'error');
                                }
                              } catch (err) {
                                showNotification('Failed to download markdown.', 'error');
                              }
                            }}
                            sx={{ color: '#64748b', '&:hover': { color: '#0b1c30', backgroundColor: '#f1f5f9' } }}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Resume">
                          <IconButton
                            size="small"
                            onClick={() => setDeleteConfirmId(resume.id)}
                            sx={{ color: '#ef4444', '&:hover': { backgroundColor: '#fef2f2' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>

                      <Button
                        size="small"
                        variant={isCopilotActive ? 'contained' : 'outlined'}
                        color={activeTab === 'uploads' ? 'primary' : 'secondary'}
                        startIcon={<SmartToyIcon />}
                        onClick={() => handleUseInCopilot(resume.id)}
                        disabled={isCopilotActive}
                        sx={{
                          borderRadius: '8px',
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          px: 1.5,
                          py: 0.5,
                        }}
                      >
                        {isCopilotActive ? 'Attached' : 'Use in Copilot'}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}

        {/* ─── UPLOAD DIALOG ─────────────────────────────────────────────────── */}
        <Dialog
          open={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, pt: 2, pb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Upload Base CV Document</Typography>
            <IconButton onClick={() => setIsUploadOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
          <DialogContent sx={{ px: 2, pb: 2, pt: 1 }}>
            <ResumeUpload onUploaded={(id) => {
              setIsUploadOpen(false);
              handleUseInCopilot(id);
            }} />
          </DialogContent>
        </Dialog>

        {/* ─── VIEW PREVIEW DIALOG ────────────────────────────────────────────── */}
        <Dialog
          open={Boolean(viewingResumeId)}
          onClose={() => setViewingResumeId(null)}
          maxWidth="md"
          fullWidth
          scroll="paper"
          PaperProps={{
            sx: {
              borderRadius: 4,
              boxShadow: '0 24px 64px rgba(11, 28, 48, 0.18)',
              height: '80vh',
            },
          }}
          BackdropProps={{
            sx: { backgroundColor: 'rgba(11, 28, 48, 0.55)', backdropFilter: 'blur(4px)' },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              pt: 2.5,
              pb: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
              <DescriptionIcon sx={{ color: activeTab === 'uploads' ? '#004ac6' : '#7c3aed' }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0b1c30', lineHeight: 1.2 }} noWrap>
                  {viewingResume?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {viewingResume?.type.toUpperCase()} · Template: {viewingResume?.template_id}
                </Typography>
              </Box>
            </Stack>
            <IconButton onClick={() => setViewingResumeId(null)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          <DialogContent sx={{ px: 3, py: 2.5, backgroundColor: '#f8fafc' }}>
            {isViewingContentLoading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
                <CircularProgress size={40} thickness={4} />
                <Typography variant="body2" color="text.secondary">Loading document content...</Typography>
              </Box>
            ) : viewingContent ? (
              <Paper
                variant="outlined"
                sx={{
                  p: 4,
                  borderRadius: 3,
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 12px rgba(11,28,48,0.02)',
                  minHeight: '100%',
                }}
              >
                <Box
                  sx={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    color: '#1e293b',
                    lineHeight: 1.6,
                    '& h1': {
                      fontSize: '1.65rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      borderBottom: '2px solid #004ac6',
                      pb: 1,
                      mt: 3,
                      mb: 2,
                    },
                    '& h2': {
                      fontSize: '1.2rem',
                      fontWeight: 700,
                      color: '#1e3a8a',
                      borderBottom: '1px solid #e2e8f0',
                      pb: 0.5,
                      mt: 3,
                      mb: 1.5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    },
                    '& h3': {
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      color: '#334155',
                      mt: 2,
                      mb: 1,
                    },
                    '& p': {
                      fontSize: '0.9rem',
                      color: '#475569',
                      mb: 1.5,
                    },
                    '& ul, & ol': {
                      pl: 3,
                      mb: 2,
                    },
                    '& li': {
                      fontSize: '0.9rem',
                      color: '#475569',
                      mb: 0.5,
                    },
                    '& strong': {
                      color: '#0f172a',
                      fontWeight: 600,
                    },
                    '& hr': {
                      borderColor: '#e2e8f0',
                      my: 3,
                    }
                  }}
                >
                  <ReactMarkdown>{viewingContent.raw_text}</ReactMarkdown>
                </Box>
              </Paper>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography color="text.secondary">Failed to load resume content.</Typography>
              </Box>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2.5, gap: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              startIcon={<ContentCopyIcon />}
              onClick={() => viewingContent && copyToClipboard(viewingContent.raw_text)}
              sx={{ textTransform: 'none', fontWeight: 600 }}
              disabled={!viewingContent}
            >
              Copy Text
            </Button>
            <Button
              startIcon={<DownloadIcon />}
              variant="outlined"
              onClick={() => {
                if (viewingResume && viewingContent) {
                  handleClientPdfDownload(viewingResume.name, viewingContent.raw_text);
                }
              }}
              sx={{ textTransform: 'none', fontWeight: 600 }}
              disabled={!viewingContent}
            >
              Download PDF
            </Button>
            <Button
              startIcon={<DescriptionIcon />}
              variant="outlined"
              onClick={() => {
                if (viewingResume && viewingContent) {
                  handleDownloadMarkdown(viewingResume.name, viewingContent.raw_text);
                }
              }}
              sx={{ textTransform: 'none', fontWeight: 600 }}
              disabled={!viewingContent}
            >
              Download MD
            </Button>
            <Button
              startIcon={<EditIcon />}
              variant="outlined"
              onClick={() => {
                if (viewingResumeId) {
                  setEditingResumeId(viewingResumeId);
                  setViewingResumeId(null);
                }
              }}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Edit Fields
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              onClick={() => setViewingResumeId(null)}
              variant="contained"
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* ─── EDIT FIELDS DIALOG ────────────────────────────────────────────── */}
        <Dialog
          open={Boolean(editingResumeId)}
          onClose={() => setEditingResumeId(null)}
          maxWidth="md"
          fullWidth
          scroll="paper"
          PaperProps={{
            sx: {
              borderRadius: 4,
              boxShadow: '0 24px 64px rgba(11, 28, 48, 0.18)',
              height: '85vh',
            },
          }}
          BackdropProps={{
            sx: { backgroundColor: 'rgba(11, 28, 48, 0.55)', backdropFilter: 'blur(4px)' },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              pt: 2.5,
              pb: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0b1c30' }}>
              Edit Resume Fields
            </Typography>
            <IconButton onClick={() => setEditingResumeId(null)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          <DialogContent sx={{ px: 3, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {isEditingContentLoading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
                <CircularProgress size={40} thickness={4} />
                <Typography variant="body2" color="text.secondary">Fetching resume elements...</Typography>
              </Box>
            ) : editingContent ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Modifying CV text directly saves changes to this resume version.
                </Typography>

                <TextField
                  label="Edit Resume Content (Plain Text / Markdown)"
                  fullWidth
                  multiline
                  rows={20}
                  variant="outlined"
                  placeholder="Paste or write your resume/CV content here in plain text or markdown..."
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#fafbfc',
                      fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                      fontSize: '0.9rem',
                    },
                    '& .MuiInputLabel-root': { fontWeight: 600 }
                  }}
                />
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography color="text.secondary">Could not find resume content to edit.</Typography>
              </Box>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2.5, gap: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              onClick={() => setEditingResumeId(null)}
              variant="outlined"
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
              disabled={updateResumeRawMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditedResume}
              variant="contained"
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #004ac6 0%, #002d8c 100%)',
              }}
              disabled={!editingContent || updateResumeRawMutation.isPending}
            >
              {updateResumeRawMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ─── DELETE CONFIRMATION DIALOG ────────────────────────────────────── */}
        <Dialog
          open={Boolean(deleteConfirmId)}
          onClose={() => setDeleteConfirmId(null)}
          PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
        >
          <Box sx={{ px: 2, pt: 2, pb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#ef4444' }}>Delete Resume?</Typography>
          </Box>
          <DialogContent sx={{ px: 2, py: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.5 }}>
              Are you sure you want to permanently delete <strong>{resumeToDelete?.name}</strong>? This will remove all parsed database elements and related stored PDF/DOCX files. This action is irreversible.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2, pt: 1, gap: 1 }}>
            <Button
              onClick={() => setDeleteConfirmId(null)}
              variant="outlined"
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
              disabled={deleteResumeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteResume}
              variant="contained"
              color="error"
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
              disabled={deleteResumeMutation.isPending}
            >
              {deleteResumeMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </DialogActions>
        </Dialog>

      </Box>
    </ErrorBoundary>
  );
}

export default ResumesPage;
