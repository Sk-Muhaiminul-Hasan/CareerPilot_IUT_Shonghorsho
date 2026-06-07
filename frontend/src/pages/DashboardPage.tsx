import { useCallback } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';

import StatsCards from '@/components/dashboard/StatsCards';
import ApplicationFunnel from '@/components/dashboard/ApplicationFunnel';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import NudgeCard from '@/components/dashboard/NudgeCard';
import AINotConfiguredBanner from '@/components/AINotConfiguredBanner';
import type { ApiError } from '@/types/api';
import { useDashboardStats, useApplicationFunnel } from '@/hooks/useAnalytics';
import { useApplications } from '@/hooks/useApplications';
import { useNudge, useNudgeAIError } from '@/hooks/useNudge';
import { useJobStore } from '@/store/useJobStore';
import ListItemButton from '@mui/material/ListItemButton';
import { useNavigate } from 'react-router-dom';

function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: funnel, isLoading: funnelLoading } = useApplicationFunnel();
  const { data: recentApps } = useApplications(1, 5);
  const { data: nudge, isLoading: nudgeLoading, error: nudgeError } = useNudge();
  const aiNotConfigured = useNudgeAIError(nudgeError as ApiError | null | undefined);
  const { openDetail } = useJobStore();
  const navigate = useNavigate();

  const handleViewDetails = useCallback((jobId: string) => {
    navigate('/jobs');
    openDetail(jobId);
  }, [navigate, openDetail]);

  const handleNudgeApply = useCallback((jobId: string) => {
    navigate('/jobs');
    openDetail(jobId);
  }, [navigate, openDetail]);

  const handleAppClick = useCallback(
    (appId: string) => {
      navigate(`/applications/${appId}`);
    },
    [navigate],
  );

  return (
    <ErrorBoundary>
      <Box>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Overview of your job application pipeline
        </Typography>

        {aiNotConfigured ? (
          <AINotConfiguredBanner message="Configure your AI model to unlock personalized nudges." />
        ) : (
          <NudgeCard nudge={nudge} loading={nudgeLoading} onViewDetails={handleViewDetails} onApply={handleNudgeApply} />
        )}

        <StatsCards stats={stats} loading={statsLoading} />

        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12} md={8}>
            <ApplicationFunnel data={funnel} loading={funnelLoading} />
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Applications
                </Typography>

                {recentApps && recentApps.items.length > 0 ? (
                  <List disablePadding>
                    {recentApps.items.map((app) => {
                      const name = app.job_title || app.job_id.slice(0, 8);
                      const suffix = app.job_company ? ` @ ${app.job_company}` : '';
                      return (
                        <ListItem key={app.id} disablePadding sx={{ mb: 0.5 }}>
                          <ListItemButton onClick={() => handleAppClick(app.id)}>
                            <ListItemText
                              primary={`${name}${suffix}`}
                              secondary={new Date(app.created_at).toLocaleDateString()}
                              primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                              secondaryTypographyProps={{ variant: 'caption' }}
                            />
                            <Chip label={app.status} size="small" variant="outlined" />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                ) : (
                  <Box
                    sx={{
                      textAlign: 'center',
                      py: 4,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      No applications yet. Start by searching for jobs.
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </ErrorBoundary>
  );
}

export default DashboardPage;
