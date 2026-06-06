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
  Link as MuiLink,
  Stack,
} from '@mui/material';

import { useOnboardingStatus, useCompleteOnboarding } from '@/hooks/useSettings';
import { useUpdateSettings } from '@/hooks/useSettings';
import { useAppStore } from '@/store/useAppStore';
import ResumeUpload from '@/components/resumes/ResumeUpload';
import LoadingState from '@/components/common/LoadingState';

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

const PROVIDER_LINKS: Record<string, string> = {
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/',
  gemini: 'https://aistudio.google.com/apikey',
  groq: 'https://console.groq.com/keys',
  openrouter: 'https://openrouter.ai/keys',
};

const STEPS = ['Set up your AI', 'Set up your CV analyzer', 'Upload your CV'];

function StepOne({
  values,
  onChange,
  onSkip,
}: {
  values: { provider: string; model: string; apiKey: string };
  onChange: (v: typeof values) => void;
  onSkip: () => void;
}) {
  const handleProviderChange = (event: SelectChangeEvent) => {
    const newProvider = event.target.value;
    onChange({
      provider: newProvider,
      model: PROVIDER_MODEL_DEFAULTS[newProvider] ?? '',
      apiKey: values.apiKey,
    });
  };

  return (
    <Stack spacing={2.5}>
      <Typography variant="body1">
        Choose the AI model that powers your job search, nudges, and cover letters.
      </Typography>
      <FormControl fullWidth>
        <InputLabel>Provider</InputLabel>
        <Select
          value={values.provider}
          label="Provider"
          onChange={handleProviderChange}
        >
          {PROVIDERS.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {p.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        label="Model"
        value={values.model}
        onChange={(e) => onChange({ ...values, model: e.target.value })}
        fullWidth
        helperText={
          values.provider
            ? `Suggested: ${PROVIDER_MODEL_DEFAULTS[values.provider] ?? ''}`
            : ''
        }
      />
      <TextField
        label="API Key"
        type="password"
        value={values.apiKey}
        onChange={(e) => onChange({ ...values, apiKey: e.target.value })}
        fullWidth
        helperText={
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            Get a free API key from your provider's website.
            {PROVIDER_LINKS[values.provider] && (
              <MuiLink
                href={PROVIDER_LINKS[values.provider]}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'primary.main', cursor: 'pointer', ml: 0.5 }}
              >
                Get your API key →
              </MuiLink>
            )}
          </Box>
        }
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
        <MuiLink
          component="button"
          type="button"
          variant="body2"
          onClick={onSkip}
          sx={{ textTransform: 'none', cursor: 'pointer' }}
        >
          Skip for now
        </MuiLink>
      </Box>
    </Stack>
  );
}

function StepTwo({
  values,
  onChange,
  onSkip,
}: {
  values: { provider: string; model: string; apiKey: string };
  onChange: (v: typeof values) => void;
  onSkip: () => void;
}) {
  const handleProviderChange = (event: SelectChangeEvent) => {
    const newProvider = event.target.value;
    onChange({
      provider: newProvider,
      model: PROVIDER_MODEL_DEFAULTS[newProvider] ?? values.model,
      apiKey: values.apiKey,
    });
  };

  return (
    <Stack spacing={2.5}>
      <Typography variant="body1">
        This model reads and structures your CV. Choose a provider and model that supports reliable JSON output.
      </Typography>
      <FormControl fullWidth>
        <InputLabel>Provider</InputLabel>
        <Select
          value={values.provider}
          label="Provider"
          onChange={handleProviderChange}
        >
          {PROVIDERS.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {p.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        label="Model"
        value={values.model}
        onChange={(e) => onChange({ ...values, model: e.target.value })}
        fullWidth
        helperText={
          values.provider
            ? `Suggested: ${PROVIDER_MODEL_DEFAULTS[values.provider] ?? ''}`
            : ''
        }
      />
      <Alert severity="warning" sx={{ borderRadius: 1, fontSize: '0.8rem' }}>
        ⚠️ Use a model with reliable JSON output (e.g. gpt-4o-mini, claude-3-5-sonnet-20241022, gemini-1.5-flash). Small or free-tier models like gpt-5-nano may fail to parse your CV correctly.
      </Alert>
      <TextField
        label="API Key"
        type="password"
        value={values.apiKey}
        onChange={(e) => onChange({ ...values, apiKey: e.target.value })}
        fullWidth
        helperText={
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            Get a free API key from your provider's website.
            {PROVIDER_LINKS[values.provider] && (
              <MuiLink
                href={PROVIDER_LINKS[values.provider]}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'primary.main', cursor: 'pointer', ml: 0.5 }}
              >
                Get your API key →
              </MuiLink>
            )}
          </Box>
        }
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
        <MuiLink
          component="button"
          type="button"
          variant="body2"
          onClick={onSkip}
          sx={{ textTransform: 'none', cursor: 'pointer' }}
        >
          Skip for now
        </MuiLink>
      </Box>
    </Stack>
  );
}

function StepThree({ onSkip }: { onSkip: () => void }) {
  return (
    <Stack spacing={2.5} alignItems="center" textAlign="center">
      <Typography variant="body1">
        Upload your CV so we can extract your profile automatically.
        You can always add or replace it later.
      </Typography>
      <ResumeUpload />
      <MuiLink
        component="button"
        type="button"
        variant="body2"
        onClick={onSkip}
        sx={{ textTransform: 'none', cursor: 'pointer' }}
      >
        Skip for now
      </MuiLink>
    </Stack>
  );
}

function OnboardingPage() {
  const navigate = useNavigate();
  const showNotification = useAppStore((s) => s.showNotification);
  const { data: status, isLoading } = useOnboardingStatus();
  const completeOnboardingMutation = useCompleteOnboarding();
  const updateMutation = useUpdateSettings();

  const [activeStep, setActiveStep] = useState(0);
  const [general, setGeneral] = useState({ provider: 'openai', model: '', apiKey: '' });
  const [extraction, setExtraction] = useState({ provider: 'openai', model: 'gpt-4o-mini', apiKey: '' });

  useEffect(() => {
    if (status?.onboarding_complete && !isLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [status, isLoading, navigate]);

  if (isLoading) {
    return <LoadingState message="Loading..." />;
  }

  const handleSaveAndContinue = async () => {
    try {
      await updateMutation.mutateAsync({
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

  const handleFinish = async () => {
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
          {activeStep < 2 ? (
            <Button variant="contained" onClick={handleSaveAndContinue}>
              Next
            </Button>
          ) : (
            <Button variant="contained" onClick={handleFinish}>
              Finish Setup
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
}

export default OnboardingPage;
