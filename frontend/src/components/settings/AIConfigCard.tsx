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

const PROVIDER_MODEL_DEFAULTS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-1.5-flash',
  google: 'gemini-1.5-flash',
  groq: 'llama-3.1-70b-versatile',
  openrouter: 'openrouter/auto',
};

interface AIConfigCardProps {
  settings: {
    preferred_provider: string;
    preferred_model: string | null;
    user_api_key: string | null;
  } | null;
  onSave: (field: string, value: unknown) => void;
}

function AIConfigCard({ settings, onSave }: AIConfigCardProps) {
  const [provider, setProvider] = useState(settings?.preferred_provider ?? 'server');
  const [model, setModel] = useState(settings?.preferred_model ?? '');
  const [apiKey, setApiKey] = useState(settings?.user_api_key ?? '');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (settings) {
      setProvider(settings.preferred_provider ?? 'server');
      setModel(settings.preferred_model ?? '');
      setApiKey(settings.user_api_key ?? '');
    }
  }, [settings]);

  const handleProviderChange = (event: SelectChangeEvent) => {
    const newProvider = event.target.value;
    setProvider(newProvider);
    if (newProvider === 'server') {
      setModel('');
      setApiKey('');
      onSave('preferred_provider', 'server');
      onSave('preferred_model', null);
      onSave('user_api_key', null);
    } else {
      const defaultModel = PROVIDER_MODEL_DEFAULTS[newProvider] ?? '';
      setModel(defaultModel);
      onSave('preferred_provider', newProvider);
      onSave('preferred_model', defaultModel);
    }
  };

  const handleModelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setModel(event.target.value);
    onSave('preferred_model', event.target.value || null);
  };

  const handleApiKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(event.target.value);
    onSave('user_api_key', event.target.value || null);
  };

  const handleSaveClick = () => {
    onSave('preferred_provider', provider === 'server' ? 'server' : provider);
    onSave('preferred_model', model || null);
    onSave('user_api_key', apiKey || null);
  };

  const effectiveProvider = provider === 'server' ? 'server' : provider;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          AI Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose your own AI provider, model, and API key. Your key is stored
          securely and used only for your account.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Provider</InputLabel>
            <Select
              value={effectiveProvider}
              onChange={handleProviderChange}
              label="Provider"
            >
              <MenuItem value="server">Server Default</MenuItem>
              <MenuItem value="openai">OpenAI</MenuItem>
              <MenuItem value="anthropic">Anthropic</MenuItem>
              <MenuItem value="gemini">Google Gemini</MenuItem>
              <MenuItem value="groq">Groq</MenuItem>
              <MenuItem value="openrouter">OpenRouter</MenuItem>
            </Select>
          </FormControl>

          {effectiveProvider !== 'server' && (
            <TextField
              label="Model"
              value={model ?? ''}
              onChange={handleModelChange}
              fullWidth
              helperText={
                effectiveProvider ? `Suggested: ${PROVIDER_MODEL_DEFAULTS[effectiveProvider] ?? ''}` : ''
              }
            />
          )}

          {effectiveProvider !== 'server' && (
            <Box>
              <TextField
                label="API Key"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey ?? ''}
                onChange={handleApiKeyChange}
                fullWidth
                helperText="Your key is stored securely and used only for your account."
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
          )}
        </Box>

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" onClick={handleSaveClick}>
            Save AI Configuration
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export default AIConfigCard;
