import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import { useResumes } from '@/hooks/useResumes';

interface ApplyModalProps {
  open: boolean;
  jobTitle: string;
  company: string;
  jobUrl: string;
  onClose: () => void;
  onConfirm: (mode: string, resumeId: string) => void;
}

const MODES = [
  {
    value: 'review',
    title: 'Review First',
    description: 'Generate a tailored cover letter and resume tailored to this job. You approve before applying.',
    badge: 'Recommended',
    badgeColor: 'primary',
  },
  {
    value: 'autonomous',
    title: 'Auto Apply',
    description: 'Automatically apply to this job using your profile. Some platforms may not support full automation.',
    badge: 'Beta',
    badgeColor: 'warning',
  },
  {
    value: 'manual',
    title: 'Apply Manually',
    description: 'Record this job and open the application page. You handle submission yourself.',
    badge: null,
    badgeColor: null,
  },
] as const;

function ApplyModal({ open, jobTitle, company, jobUrl, onClose, onConfirm }: ApplyModalProps) {
  const [selectedMode, setSelectedMode] = useState<string>('review');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const { data: resumesData, isLoading, isError } = useResumes();
  const resumes = resumesData?.items ?? [];

  useEffect(() => {
    if (open && resumes.length > 0 && !selectedResumeId) {
      const baseResume = resumes.find((r) => r.type === 'base');
      setSelectedResumeId(baseResume?.id ?? resumes[0]!.id);
    }
    if (!open) {
      setSelectedMode('review');
      setSelectedResumeId('');
    }
  }, [open, resumes, selectedResumeId]);

  const handleConfirm = () => {
    if (selectedMode && selectedResumeId) {
      onConfirm(selectedMode, selectedResumeId);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const canConfirm = selectedMode === 'manual' || (selectedMode && selectedResumeId);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth data-job-url={jobUrl}>
      <DialogTitle>Apply to {jobTitle} at {company}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose how you'd like to apply to this position.
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {MODES.map((mode) => {
            const isSelected = selectedMode === mode.value;
            return (
              <Box
                key={mode.value}
                onClick={() => setSelectedMode(mode.value)}
                sx={{
                  p: 2,
                  border: `2px solid ${isSelected ? '#6366F1' : '#e0e0e0'}`,
                  borderRadius: 1,
                  cursor: 'pointer',
                  bgcolor: isSelected ? 'rgba(99,102,241,0.05)' : 'background.paper',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {mode.title}
                  </Typography>
                  {mode.badge && (
                    <Typography
                      variant="caption"
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        bgcolor: mode.badgeColor === 'primary' ? 'primary.main' : 'warning.main',
                        color: '#fff',
                        fontWeight: 600,
                      }}
                    >
                      {mode.badge}
                    </Typography>
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {mode.description}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* CV selection — hidden when Apply Manually is chosen */}
        {selectedMode !== 'manual' && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Select Resume
            </Typography>
            {isLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}
            {isError && (
              <Alert severity="error" sx={{ mb: 1 }}>
                Failed to load resumes.
              </Alert>
            )}
            {!isLoading && !isError && resumes.length === 0 && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                No resumes found. Please upload a resume first.
              </Alert>
            )}
            {!isLoading && !isError && resumes.length > 0 && (
              <RadioGroup
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
              >
                {resumes.map((resume) => (
                  <FormControlLabel
                    key={resume.id}
                    value={resume.id}
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body2">{resume.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {resume.type === 'base' ? 'Base Resume' : 'Tailored Resume'}
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </RadioGroup>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained" disabled={!canConfirm}>
          Confirm Application
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ApplyModal;
