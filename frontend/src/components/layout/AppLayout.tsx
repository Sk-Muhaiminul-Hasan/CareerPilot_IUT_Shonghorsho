import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import Sidebar, { DRAWER_WIDTH } from './Sidebar';
import Header from './Header';
import { useAppStore } from '@/store/useAppStore';
import { useSharedWebSocket } from '@/contexts/SharedWebSocketProvider';
import { useOnboardingStatus } from '@/hooks/useSettings';

export default function AppLayout() {
  const navigate = useNavigate();
  const { connected } = useSharedWebSocket();
  const setWsConnected = useAppStore((s) => s.setWsConnected);
  const { data: onboardingStatus } = useOnboardingStatus();

  const showSetupBanner = onboardingStatus && !onboardingStatus.has_general_ai;

  useEffect(() => {
    setWsConnected(connected);
  }, [connected, setWsConnected]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Header />
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          bgcolor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        {showSetupBanner && (
          <Box sx={{
            background: '#6366F1',
            color: 'white',
            py: 1,
            px: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Typography variant="body2">
              Complete your AI setup to unlock all features
            </Typography>
            <Button
              size="small"
              variant="outlined"
              sx={{ color: 'white', borderColor: 'white' }}
              onClick={() => navigate('/onboarding')}
            >
              Set up now
            </Button>
          </Box>
        )}
        <Box sx={{ p: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
