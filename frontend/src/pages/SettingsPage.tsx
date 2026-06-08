import { useCallback } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';

import LoadingState from '@/components/common/LoadingState';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import CandidateProfileEditor from '@/components/settings/CandidateProfileEditor';
import AISlotConfigCard from '@/components/settings/AISlotConfigCard';
import ScheduledSearchesCard from '@/components/settings/ScheduledSearchesCard';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';

function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();
  const showNotification = useAppStore((s) => s.showNotification);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleUpdate = useCallback(
    (field: string, value: unknown) => {
      updateMutation.mutate(
        { [field]: value },
        {
          onSuccess: () => showNotification('Settings saved.', 'success'),
          onError: () => showNotification('Failed to save settings.', 'error'),
        },
      );
    },
    [updateMutation, showNotification],
  );

  const handleApplyModeChange = useCallback(
    (event: SelectChangeEvent) => {
      handleUpdate('apply_mode', event.target.value);
    },
    [handleUpdate],
  );

  const handleATSThresholdCommit = useCallback(
    (_: React.SyntheticEvent | Event, value: number | number[]) => {
      if (typeof value === 'number') {
        handleUpdate('min_ats_score', value / 100);
      }
    },
    [handleUpdate],
  );

  const handlePlatformToggle = useCallback(
    (platform: string, enabled: boolean) => {
      if (!settings) return;
      const updated = enabled
        ? [...settings.platforms_enabled, platform]
        : settings.platforms_enabled.filter((p) => p !== platform);
      handleUpdate('platforms_enabled', updated);
    },
    [settings, handleUpdate],
  );

  const handleProfileSave = useCallback(
    (profile: CandidateProfile) => {
      handleUpdate('candidate_profile', profile);
    },
    [handleUpdate],
  );

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  if (isLoading) {
    return <LoadingState message="Loading settings..." />;
  }

  return (
    <ErrorBoundary>
      <Box>
        <Typography variant="h4" gutterBottom>
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Configure your AutoApply preferences
        </Typography>

        <Grid container spacing={3}>
          {/* Profile */}
          <Grid item xs={12}>
            <CandidateProfileEditor
              profile={settings?.candidate_profile}
              onSave={handleProfileSave}
            />
          </Grid>

          {/* Two separate AI config slots */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <AISlotConfigCard
                title="General AI"
                subtitle="Powers your job search, nudges, cover letters, and resume tailoring."
                config={
                  settings
                    ? {
                        provider: settings.general_provider,
                        model: settings.general_model,
                        apiKey: settings.general_api_key,
                      }
                    : null
                }
                onSave={(values) =>
                  updateMutation.mutate(
                    {
                      general_provider: values.provider,
                      general_model: values.model || null,
                      general_api_key: values.apiKey || null,
                    },
                    {
                      onSuccess: () => showNotification('General AI settings saved.', 'success'),
                      onError: () => showNotification('Failed to save settings.', 'error'),
                    },
                  )
                }
              />

              <AISlotConfigCard
                title="Extraction AI"
                subtitle="Reads and understands your CV when uploading a resume."
                config={
                  settings
                    ? {
                        provider: settings.extraction_provider,
                        model: settings.extraction_model,
                        apiKey: settings.extraction_api_key,
                      }
                    : null
                }
                onSave={(values) =>
                  updateMutation.mutate(
                    {
                      extraction_provider: values.provider,
                      extraction_model: values.model || null,
                      extraction_api_key: values.apiKey || null,
                    },
                    {
                      onSuccess: () => showNotification('Extraction AI settings saved.', 'success'),
                      onError: () => showNotification('Failed to save settings.', 'error'),
                    },
                  )
                }
                recommendedBadge
                helperText="We recommend OpenAI gpt-4o-mini for best CV parsing accuracy."
                buttonLabel="Save Extraction AI"
              />
            </Box>
          </Grid>

          {/* Scheduled searches */}
          <Grid item xs={12}>
            <ScheduledSearchesCard />
          </Grid>

          {/* Logout */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Account
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Sign out of your CareerPilot account on this device.
                </Typography>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<LogoutIcon />}
                  onClick={handleLogout}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Logout
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </ErrorBoundary>
  );
}

export default SettingsPage;