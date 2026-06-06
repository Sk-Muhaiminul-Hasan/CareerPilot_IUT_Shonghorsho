import { useState, useEffect } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import type { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';

const PROVIDER_MODEL_DEFAULTS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-1.5-flash',
  google: 'gemini-1.5-flash',
  groq: 'llama-3.1-70b-versatile',
  openrouter: 'openrouter/auto',
};

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', recommended: true },
  { value: 'anthropic', label: 'Anthropic', recommended: false },
  { value: 'gemini', label: 'Google Gemini', recommended: false },
  { value: 'groq', label: 'Groq', recommended: false },
  { value: 'openrouter', label: 'OpenRouter', recommended: false },
];

interface AISlotConfigCardProps {
  title: string;
  subtitle: string;
  config: {
    provider: string | null;
    model: string | null;
    apiKey: string | null;
  } | null;
  onSave: (values: { provider: string; model: string; apiKey: string }) => void;
  recommendedBadge?: boolean;
  helperText?: string;
  buttonLabel?: string;
}

function AISlotConfigCard({
  title,
  subtitle,
  config,
  onSave,
  recommendedBadge = false,
  helperText = 'Get an API key from your provider\'s website.',
  buttonLabel = 'Save',
}: AISlotConfigCardProps) {
  const [provider, setProvider] = useState(config?.provider ?? 'openai');
  const [model, setModel] = useState(config?.model ?? '');
  const [apiKey, setApiKey] = useState(config?.apiKey ?? '');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (config) {
      setProvider(config.provider ?? 'openai');
      setModel(config.model ?? '');
      setApiKey(config.apiKey ?? '');
    }
  }, [config]);

  const handleProviderChange = (event: SelectChangeEvent) => {
    const newProvider = event.target.value;
    setProvider(newProvider);
    const defaultModel = PROVIDER_MODEL_DEFAULTS[newProvider] ?? '';
    setModel(defaultModel);
  };

  const handleModelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setModel(event.target.value);
  };

  const handleApiKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(event.target.value);
  };

  const handleSaveClick = () => {
    onSave({ provider, model, apiKey });
  };

  const recommendedProvider = PROVIDERS.find((p) => p.recommended);

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="h6">
            {title}
          </Typography>
          {recommendedBadge && recommendedProvider && (
            <Chip
              label={`Recommended: ${recommendedProvider.label}`}
              size="small"
              color="primary"
              sx={{ fontWeight: 500 }}
            />
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {subtitle}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Provider</InputLabel>
            <Select
              value={provider}
              onChange={handleProviderChange}
              label="Provider"
            >
              {PROVIDERS.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.recommended ? `${p.label} (Recommended)` : p.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Model"
            value={model}
            onChange={handleModelChange}
            fullWidth
            helperText={
              provider
                ? `Suggested: ${PROVIDER_MODEL_DEFAULTS[provider] ?? ''}`
                : ''
            }
          />

          <Box>
            <TextField
              label="API Key"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={handleApiKeyChange}
              fullWidth
              helperText={helperText}
            />
            <Box sx={{ mt: 0.5, textAlign: 'right' }}>
              <Button
                size="small"
                onClick={() => setShowApiKey((prev) => !prev)}
                sx={{ minWidth: 0, textTransform: 'none' }}
              >
                {showApiKey ? 'Hide key' : 'Show key'}
              </Button>
            </Box>
          </Box>
        </Box>

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" onClick={handleSaveClick}>
            {buttonLabel}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export default AISlotConfigCard;
