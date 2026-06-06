import { Routes, Route, Navigate } from 'react-router-dom';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

import AppLayout from '@/components/layout/AppLayout';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import JobSearchPage from '@/pages/JobSearchPage';
import ApplicationDetailPage from '@/pages/ApplicationDetailPage';
import ApplicationsPage from '@/pages/ApplicationsPage';
import ResumesPage from '@/pages/ResumesPage';
import SettingsPage from '@/pages/SettingsPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import LoadingState from '@/components/common/LoadingState';

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
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            user ? (
              <AppLayout />
            ) : (
              <Navigate to="/login" replace />
            )
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

