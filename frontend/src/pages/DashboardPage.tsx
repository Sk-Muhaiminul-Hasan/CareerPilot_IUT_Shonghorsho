import { useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';

import ErrorBoundary from '@/components/common/ErrorBoundary';
import StatsCards from '@/components/dashboard/StatsCards';
import ApplicationFunnel from '@/components/dashboard/ApplicationFunnel';

import NudgeCard from '@/components/dashboard/NudgeCard';
import AINotConfiguredBanner from '@/components/AINotConfiguredBanner';
import type { ApiError } from '@/types/api';
import { useDashboardStats, useApplicationFunnel } from '@/hooks/useAnalytics';
import { useApplications } from '@/hooks/useApplications';
import { useNudge, useNudgeAIError } from '@/hooks/useNudge';
import { useGoals, useCalendarEvents, useWeeklyProgress } from '@/hooks/useDashboard';

import RecentApplications from '@/components/dashboard/RecentApplications';
import ActiveGoals from '@/components/dashboard/ActiveGoals';
import WeeklyProgress from '@/components/dashboard/WeeklyProgress';
import UpcomingEvents from '@/components/dashboard/UpcomingEvents';
import CalendarView from '@/components/dashboard/CalendarView';
import GoalsView from '@/components/dashboard/GoalsView';
import TrackerView from '@/components/dashboard/TrackerView';

type DashTab = 'overview' | 'tracker' | 'calendar' | 'goals';

interface TabDef {
  value: DashTab;
  label: string;
  icon: React.ReactElement;
}

const TABS: TabDef[] = [
  { value: 'overview', label: 'Overview', icon: <GridViewRoundedIcon sx={{ fontSize: 18 }} /> },
  { value: 'tracker', label: 'Application Tracker', icon: <ViewKanbanIcon sx={{ fontSize: 18 }} /> },
  { value: 'calendar', label: 'Calendar & To-Do', icon: <CalendarMonthIcon sx={{ fontSize: 18 }} /> },
  { value: 'goals', label: 'Goal Management', icon: <TrackChangesIcon sx={{ fontSize: 18 }} /> },
];

/** Format a date range string for the header, e.g. "June 14 â€“ June 20, 2024". */
function getWeekRange(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const startOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const start = new Date(now);
  start.setDate(now.getDate() + startOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return `${fmt(start)} â€“ ${fmt(end)}, ${end.getFullYear()}`;
}
const TAB_TITLES: Record<DashTab, { title: string; subtitle: string }> = {
  overview: { title: 'Dashboard Overview', subtitle: 'Your career trajectory at a glance.' },
  tracker: { title: 'Application Funnel', subtitle: 'Visualizing your path to the next career milestone.' },
  calendar: { title: 'Career Growth Calendar', subtitle: 'All your interviews, deadlines, and sessions in one place.' },
  goals: { title: 'Goal Management', subtitle: 'Track your accountability targets and accelerate your career transition.' },
};
function DashboardPage() {
  const [activeTab, setActiveTab] = useState<DashTab>('overview');

  // Data hooks — fetched regardless of active tab so switching is instant
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: funnel, isLoading: funnelLoading } = useApplicationFunnel();

  const { data: recentApps, isLoading: appsLoading } = useApplications(1, 5);
  const { data: goals, isLoading: goalsLoading } = useGoals();
  const { data: events, isLoading: eventsLoading } = useCalendarEvents();
  const { data: weeklyProgress, isLoading: progressLoading } = useWeeklyProgress();

  const { data: nudge, isLoading: nudgeLoading, error: nudgeError } = useNudge();
  const aiNotConfigured = useNudgeAIError(nudgeError as ApiError | null | undefined);

  const { title, subtitle } = TAB_TITLES[activeTab];

  return (
    <ErrorBoundary>
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>

        {aiNotConfigured ? (
          <AINotConfiguredBanner message="Configure your AI model to unlock personalized nudges." />
        ) : (
          <NudgeCard nudge={nudge} loading={nudgeLoading} />
        )}

        {/* ── Page header ───────────────────────────────────────── */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 2.5,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              fontWeight={700}
              sx={{ letterSpacing: '-0.01em', color: 'text.primary' }}
            >
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          </Box>

          {/* Week range badge */}
          <Button
            startIcon={<CalendarMonthIcon />}
            variant="outlined"
            size="small"
            onClick={() => setActiveTab('calendar')}
            sx={{
              borderRadius: 3,
              borderColor: '#c3c6d7',
              color: 'text.secondary',
              fontWeight: 500,
              fontSize: '0.82rem',
              bgcolor: '#eff4ff',
              textTransform: 'none',
              flexShrink: 0,
              mt: 0.5,
              '&:hover': { borderColor: '#004ac6', color: '#004ac6', bgcolor: '#dbe1ff' },
            }}
          >
            {getWeekRange()}
          </Button>
        </Box>

        {/* ── Tab bar ─────────────────────────────────────────── */}
        <Box
          sx={{
            mb: 3,
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, v: DashTab) => setActiveTab(v)}
            TabIndicatorProps={{
              style: { backgroundColor: '#004ac6', height: 3, borderRadius: '3px 3px 0 0' },
            }}
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.875rem',
                color: '#737686',
                minHeight: 44,
                px: 2,
                gap: 0.75,
                '&.Mui-selected': {
                  color: '#004ac6',
                  fontWeight: 600,
                },
              },
            }}
          >
            {TABS.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                label={tab.label}
                icon={tab.icon}
                iconPosition="start"
              />
            ))}
          </Tabs>
        </Box>

        {/* ── Overview tab ─────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* Row 1: KPI stats */}
            <StatsCards stats={stats} loading={statsLoading} />

            {/* Row 2: Funnel + Recent Applications */}
            <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
              <Grid item xs={12} lg={8}>
                <ApplicationFunnel data={funnel} loading={funnelLoading} />
              </Grid>
              <Grid item xs={12} lg={4}>
                <RecentApplications data={recentApps} loading={appsLoading} />
              </Grid>
            </Grid>

            {/* Row 3: Goals + Weekly Progress + Upcoming */}
            <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={4}>
                {/* "Manage" button inside ActiveGoals switches to goals tab */}
                <ActiveGoals
                  goals={goals}
                  loading={goalsLoading}
                  onManage={() => setActiveTab('goals')}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <WeeklyProgress data={weeklyProgress} loading={progressLoading} />
              </Grid>
              <Grid item xs={12} md={4}>
                {/* "Open Calendar" button switches to calendar tab */}
                <UpcomingEvents
                  events={events}
                  loading={eventsLoading}
                  onOpenCalendar={() => setActiveTab('calendar')}
                />
              </Grid>
            </Grid>
          </>
        )}

        {/* ── Application Tracker tab ──────────────────────────── */}
        {activeTab === 'tracker' && <TrackerView />}

        {/* ── Calendar tab ─────────────────────────────────────── */}
        {activeTab === 'calendar' && <CalendarView />}

        {/* ── Goals tab ────────────────────────────────────────── */}
        {activeTab === 'goals' && <GoalsView />}

      </Box>
    </ErrorBoundary>
  );
}

export default DashboardPage;
