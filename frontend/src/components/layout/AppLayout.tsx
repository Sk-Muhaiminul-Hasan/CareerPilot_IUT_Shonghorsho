import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';

import Sidebar, { DRAWER_WIDTH } from './Sidebar';
import Header from './Header';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAppStore } from '@/store/useAppStore';

// Import our new Assistant Panel and Zustand store hooks
import { CopilotChat } from '../assistant/CopilotChat';
import { useChatStore } from '@/store/useChatStore';

function AppLayout() {
  const { connected } = useWebSocket('/ws');
  const setWsConnected = useAppStore((s) => s.setWsConnected);

  // Track open state to adjust main container right padding dynamically
  const isChatOpen = useChatStore((state) => state.isOpen);

  useEffect(() => {
    setWsConnected(connected);
  }, [connected, setWsConnected]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', overflowX: 'hidden' }}>
      <Header />
      <Sidebar />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          bgcolor: 'background.default',
          minHeight: '100vh',
          transition: 'margin-right 0.3s ease',
          // If chat panel opens, shift or space out layout margin on widescreen sizes
          marginRight: isChatOpen ? '380px' : '0px',
        }}
      >
        <Toolbar />
        <Box sx={{ px: 3.5, py: 3 }}>
          <Outlet />
        </Box>
      </Box>

      {/* Mount your persistent assistant copilot window layer */}
      <CopilotChat />
    </Box>
  );
}

export default AppLayout;
