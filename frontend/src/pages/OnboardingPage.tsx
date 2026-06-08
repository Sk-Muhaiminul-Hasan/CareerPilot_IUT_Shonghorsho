import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  type SelectChangeEvent,
  MenuItem,
  TextField,
  Button,
  Alert,
  Stack,
  Card,
  CardContent,
} from '@mui/material';

import { useOnboardingStatus, useCompleteOnboarding, useUpdateSettings, useUpdatePlan } from '@/hooks/useSettings';
import { useAppStore } from '@/store/useAppStore';
import ResumeUpload from '@/components/resumes/ResumeUpload';

const PROVIDER_MODEL_DEFAULTS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-1.5-flash',
  google: 'gemini-1.5-flash',
  groq: 'llama-3.1-70b-versatile',
  openrouter: 'openrouter/auto',
};

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'groq', label: 'Groq' },
  { value: 'openrouter', label: 'OpenRouter' },
];

const STEPS = ['Set up your AI', 'Set up your CV analyzer', 'Upload your CV', 'Choose Your Plan'];


function StepOne({ values, onChange, onSkip }: { values: { provider: string; model: string; apiKey: string }; onChange: (v: { provider: string; model: string; apiKey: string }) => void; onSkip: () => void }) {
  const handleChange = (field: string) => (e: SelectChangeEvent<string>) => {
    onChange({ ...values, [field]: e.target.value });
  };
  const handleApiKey = (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...values, apiKey: e.target.value });

  return (
    <Stack spacing={3}>
      <Typography variant="h6">General AI Assistant</Typography>
      <FormControl fullWidth>
        <InputLabel>Provider</InputLabel>
        <Select value={values.provider} label="Provider" onChange={handleChange('provider')}>
          {PROVIDERS.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {p.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel>Model</InputLabel>
        <Select value={values.model || PROVIDER_MODEL_DEFAULTS[values.provider] || ''} label="Model" onChange={handleChange('model')}>
          <MenuItem value="">Default</MenuItem>
          <MenuItem value="gpt-4o-mini">GPT-4o Mini</MenuItem>
          <MenuItem value="gpt-4o">GPT-4o</MenuItem>
          <MenuItem value="gpt-4.1-mini">GPT-4.1 Mini</MenuItem>
          <MenuItem value="o3">o3</MenuItem>
          <MenuItem value="o4-mini">o4-mini</MenuItem>
          <MenuItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</MenuItem>
          <MenuItem value="claude-sonnet-4-20250514">Claude Sonnet 4</MenuItem>
          <MenuItem value="gemini-1.5-flash">Gemini 1.5 Flash</MenuItem>
          <MenuItem value="gemini-2.0-flash">Gemini 2.0 Flash</MenuItem>
          <MenuItem value="gemini-2.5-flash">Gemini 2.5 Flash</MenuItem>
          <MenuItem value="llama-3.3-70b-versatile">Llama 3.3 70B</MenuItem>
          <MenuItem value="llama-3.1-8b-instant">Llama 3.1 8B</MenuItem>
          <MenuItem value="openrouter/auto">OpenRouter Auto</MenuItem>
        </Select>
      </FormControl>
      <TextField type="password" label="API Key" value={values.apiKey} onChange={handleApiKey} helperText={values.provider === 'openai' ? 'Paste your OpenAI API key' : ''} />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onSkip}>Skip</Button>
      </Box>
    </Stack>
  );
}

function StepTwo({ values, onChange, onSkip }: { values: { provider: string; model: string; apiKey: string }; onChange: (v: { provider: string; model: string; apiKey: string }) => void; onSkip: () => void }) {
  const handleChange = (field: string) => (e: SelectChangeEvent<string>) => {
    onChange({ ...values, [field]: e.target.value });
  };
  const handleApiKey = (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...values, apiKey: e.target.value });

  return (
    <Stack spacing={3}>
      <Typography variant="h6">CV Analyzer AI</Typography>
      <Alert severity="info">
        This AI provider powers resume parsing, job matching, and cover letter generation.
      </Alert>
      <FormControl fullWidth>
        <InputLabel>Provider</InputLabel>
        <Select value={values.provider} label="Provider" onChange={handleChange('provider')}>
          {PROVIDERS.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {p.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel>Model</InputLabel>
        <Select value={values.model || PROVIDER_MODEL_DEFAULTS[values.provider] || ''} label="Model" onChange={handleChange('model')}>
          <MenuItem value="">Default</MenuItem>
          <MenuItem value="gpt-4o-mini">GPT-4o Mini</MenuItem>
          <MenuItem value="gpt-4o">GPT-4o</MenuItem>
          <MenuItem value="gpt-4.1-mini">GPT-4.1 Mini</MenuItem>
          <MenuItem value="o3">o3</MenuItem>
          <MenuItem value="o4-mini">o4-mini</MenuItem>
          <MenuItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</MenuItem>
          <MenuItem value="claude-sonnet-4-20250514">Claude Sonnet 4</MenuItem>
          <MenuItem value="gemini-1.5-flash">Gemini 1.5 Flash</MenuItem>
          <MenuItem value="gemini-2.0-flash">Gemini 2.0 Flash</MenuItem>
          <MenuItem value="gemini-2.5-flash">Gemini 2.5 Flash</MenuItem>
          <MenuItem value="llama-3.3-70b-versatile">Llama 3.3 70B</MenuItem>
          <MenuItem value="llama-3.1-8b-instant">Llama 3.1 8B</MenuItem>
          <MenuItem value="openrouter/auto">OpenRouter Auto</MenuItem>
        </Select>
      </FormControl>
      <TextField type="password" label="API Key" value={values.apiKey} onChange={handleApiKey} helperText={values.provider === 'openai' ? 'Paste your OpenAI API key' : ''} />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onSkip}>Skip</Button>
      </Box>
    </Stack>
  );
}

function StepThree({ onSkip }: { onSkip: () => void }) {
  return (
    <Stack spacing={3}>
      <Typography variant="h6">Upload Your CV</Typography>
      <Typography variant="body2" color="text.secondary">
        Upload a resume in PDF or DOCX to get job recommendations tailored to your experience.
      </Typography>
      <ResumeUpload />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onSkip}>Skip for now</Button>
      </Box>
    </Stack>
  );
}

const PREMIUM_GRADIENT = 'linear-gradient(135deg, #004ac6, #712ae2)' as const;

function StepFour({ onSelect }: { onSelect: (premium: boolean) => void }) {
  return (
    <Stack spacing={3} alignItems="center" textAlign="center">
      <Typography variant="body1">
        Choose the plan that fits your job search style. You can change this later in Settings.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          gap: 3,
          width: '100%',
          maxWidth: 720,
          mt: 1,
        }}
      >
        <Card
          variant="outlined"
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            p: 3,
          }}
        >
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            <Typography variant="h6" fontWeight={600}>
              Free
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Core job search across supported platforms. AI-powered features.
            </Typography>
            <Button variant="outlined" fullWidth onClick={() => onSelect(false)}>
              Continue with Free
            </Button>
          </CardContent>
        </Card>

        <Card
          variant="outlined"
          sx={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            p: 3,
            backgroundImage: PREMIUM_GRADIENT,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: 'common.white',
            border: '1px solid',
            borderColor: 'secondary.main',
          }}
        >
          <Box sx={{ position: 'absolute', top: 12, right: 16 }}>
            <span
              style={{
                background: 'rgba(255,255,255,0.25)',
                backdropFilter: 'blur(4px)',
                borderRadius: 999,
                padding: '2px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Recommended
            </span>
          </Box>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            <Typography variant="h6" fontWeight={600}>
              Premium
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Unlock AI semantic search, priority enrichment, and premium-only features.
            </Typography>
            <Button
              variant="contained"
              fullWidth
              sx={{
                background: 'rgba(255,255,255,0.95)',
                color: '#222',
                '&:hover': { background: 'rgba(255,255,255,1)' },
              }}
              onClick={() => onSelect(true)}
            >
              Start Premium Free
            </Button>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}

function OnboardingPage() {
  const navigate = useNavigate();
  const showNotification = useAppStore((s) => s.showNotification);
  const { data: status, isLoading, isError } = useOnboardingStatus();
  const completeOnboardingMutation = useCompleteOnboarding();
  const updateSettingsMutation = useUpdateSettings();
  const updatePlanMutation = useUpdatePlan();

  const [activeStep, setActiveStep] = useState(0);
  const [general, setGeneral] = useState({ provider: 'openai', model: '', apiKey: '' });
  const [extraction, setExtraction] = useState({ provider: 'openai', model: 'gpt-4o-mini', apiKey: '' });

  useEffect(() => {
    // Only redirect away when we have a successful status response that says
    // onboarding is already done. Don't redirect on isError/isLoading — that
    // would trap a user with a misconfigured Supabase session on a blank
    // page and prevent them from completing onboarding.
    if (status?.onboarding_complete && !isLoading && !isError) {
      navigate('/dashboard', { replace: true });
    }
  }, [status, isLoading, isError, navigate]);

  // If the status query is still loading OR failed (e.g. 401 from a bad
  // Supabase session), still show the steps so the user can finish.
  // The data hook will simply be undefined in the error case.

  const handleSaveAndContinue = async () => {
    try {
      if (activeStep >= 3) return;
      await updateSettingsMutation.mutateAsync({
        general_provider: general.provider,
        general_model: general.model || null,
        general_api_key: general.apiKey || null,
        extraction_provider: extraction.provider,
        extraction_model: extraction.model || null,
        extraction_api_key: extraction.apiKey || null,
      });
      setActiveStep((s) => s + 1);
    } catch {
      showNotification('Failed to save AI settings.', 'error');
    }
  };

  const handlePlanSelect = async (isPremium: boolean) => {
    try {
      await updatePlanMutation.mutateAsync(isPremium);
      if (isPremium) {
        showNotification('🎉 Premium activated!', 'success');
      }
      await completeOnboardingMutation.mutateAsync();
      showNotification('Onboarding complete!', 'success');
      navigate('/dashboard', { replace: true });
    } catch {
      showNotification('Failed to complete onboarding.', 'error');
    }
  };

  const handleSkipStep = () => {
    setActiveStep((s) => s + 1);
  };

  const handleSkipThird = async () => {
    try {
      await completeOnboardingMutation.mutateAsync();
      showNotification('Onboarding complete!', 'success');
      navigate('/dashboard', { replace: true });
    } catch {
      showNotification('Failed to complete onboarding.', 'error');
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return <StepOne values={general} onChange={setGeneral} onSkip={handleSkipStep} />;
      case 1:
        return <StepTwo values={extraction} onChange={setExtraction} onSkip={handleSkipStep} />;
      case 2:
        return <StepThree onSkip={handleSkipThird} />;
      case 3:
        return <StepFour onSelect={handlePlanSelect} />;
      default:
        return null;
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 6, mb: 8 }}>
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 4 }, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Welcome to CareerPilot
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Let's get you set up in just a few steps.
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ minHeight: 280, py: 2 }}>
          {renderStepContent()}
        </Box>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
          <Button
            disabled={activeStep === 0}
            onClick={() => setActiveStep((s) => s - 1)}
          >
            Back
          </Button>
          {activeStep < 3 ? (
            <Button variant="contained" onClick={handleSaveAndContinue}>
              Next
            </Button>
          ) : null}
        </Box>
      </Paper>
    </Container>
  );
}

export default OnboardingPage;
