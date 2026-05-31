import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

import { useResumes } from '@/hooks/useResumes';

interface ApplyModalProps {
  open: boolean;
  jobId: string;
  platform: string;
  onClose: () => void;
  onConfirm: (resumeId: string) => void;
}

const PLATFORM_HINTS: Record<string, string> = {
  linkedin: 'LinkedIn applications show your profile to recruiters. Cover letters are rarely displayed.',
  indeed: 'Indeed applications go directly to employers. Cover letters may be included.',
  glassdoor: 'Glassdoor applications are forwarded to the hiring company.',
};

function ApplyModal({ open, platform, onClose, onConfirm }: ApplyModalProps) {
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const { data: resumesData, isLoading, isError } = useResumes();
  const resumes = resumesData?.items ?? [];

  const handleConfirm = () => {
    if (selectedResumeId) {
      onConfirm(selectedResumeId);
      setSelectedResumeId('');
    }
  };

  const handleClose = () => {
    setSelectedResumeId('');
    onClose();
  };

  const platformHint = PLATFORM_HINTS[platform.toLowerCase()] ?? 'Your application will be sent to the employer.';

  const baseResumes = resumes.filter((r) => r.type === 'base');
  const allAvailable = baseResumes.length > 0 ? baseResumes : resumes;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select Resume</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose the resume you want to use for this application.
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          {platformHint}
        </Alert>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load resumes. Please try again.
          </Alert>
        )}
        {!isLoading && !isError && allAvailable.length === 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No resumes found. Please upload a resume first.
          </Alert>
        )}
        {!isLoading && !isError && allAvailable.length > 0 && (
          <RadioGroup
            value={selectedResumeId}
            onChange={(e) => setSelectedResumeId(e.target.value)}
          >
            {allAvailable.map((resume) => (
              <FormControlLabel
                key={resume.id}
                value={resume.id}
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1">{resume.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {resume.type === 'base' ? 'Base Resume' : 'Tailored Resume'}
                      {resume.ats_score != null ? ` • ATS Score: ${Math.round(resume.ats_score * 100)}%` : ''}
                    </Typography>
                  </Box>
                }
              />
            ))}
          </RadioGroup>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained" disabled={!selectedResumeId}>
          Confirm Application
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ApplyModal;
