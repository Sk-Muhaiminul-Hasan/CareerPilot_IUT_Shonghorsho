import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import LoginPage from '@/pages/LoginPage';
import LoadingState from '@/components/common/LoadingState';
import { useOnboardingStatus } from '@/hooks/useSettings';
import { SharedWebSocketProvider } from '@/contexts/SharedWebSocketProvider';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const JobSearchPage = lazy(() => import('@/pages/JobSearchPage'));
const ApplicationDetailPage = lazy(() => import('@/pages/ApplicationDetailPage'));
const ApplicationsPage = lazy(() => import('@/pages/ApplicationsPage'));
const ResumesPage = lazy(() => import('@/pages/ResumesPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const AppLayout = lazy(() => import('@/components/layout/AppLayout'));

function ProtectedInner() {
  const { data: onboardingStatus, isLoading, isError } = useOnboardingStatus();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !onboardingStatus) {
    return <Navigate to="/login" replace />;
  }

  if (!onboardingStatus.onboarding_complete && !onboardingStatus.has_general_ai && !onboardingStatus.has_extraction_ai) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <Suspense fallback={<LoadingState message="Loading..." />}>
      <SharedWebSocketProvider>
        <AppLayout />
      </SharedWebSocketProvider>
    </Suspense>
  );
}

function App() {
  const notification = useAppStore((s) => s.notification);
  const clearNotification = useAppStore((s) => s.clearNotification);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated) {
    return <LoadingState message="Verifying session..." />;
  }

  return (
    <>
      <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route
            path="/"
            element={
              user ? <ProtectedInner /> : <Navigate to="/login" replace />
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="jobs" element={<JobSearchPage />} />
            <Route path="applications/:appId" element={<ApplicationDetailPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="resumes" element={<ResumesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Suspense>

      <Snackbar
        open={!!notification}
        autoHideDuration={5000}
        onClose={clearNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {notification ? (
          <Alert
            onClose={clearNotification}
            severity={notification.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}

export default App;
