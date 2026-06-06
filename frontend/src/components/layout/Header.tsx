import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import MenuIcon from '@mui/icons-material/Menu';
import CircleIcon from '@mui/icons-material/Circle';

// Import the Chat bubble icon and our isolated chat store hook
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useChatStore } from '@/store/useChatStore';

import { useAppStore } from '@/store/useAppStore';
import { DRAWER_WIDTH } from './Sidebar';

function Header() {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const wsConnected = useAppStore((s) => s.wsConnected);

  // Bind the global layout action trigger directly to our state store
  const toggleCopilotChat = useChatStore((s) => s.toggleChat);

  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{
        width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        ml: { md: `${DRAWER_WIDTH}px` },
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Toolbar>
        <IconButton
          edge="start"
          onClick={toggleSidebar}
          sx={{ mr: 2, display: { md: 'none' } }}
          aria-label="Open navigation menu"
        >
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" noWrap sx={{ flexGrow: 1 }} color="text.primary">
          {/* Page title managed by individual pages */}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={
              <CircleIcon
                sx={{
                  fontSize: 10,
                  color: wsConnected ? 'success.main' : 'error.main',
                }}
              />
            }
            label={wsConnected ? 'Connected' : 'Disconnected'}
            variant="outlined"
            size="small"
            sx={{ fontWeight: 500 }}
          />

          {/* Connected Copilot Panel Injection Switch */}
          <IconButton
            color="primary"
            aria-label="Toggle Copilot Chat"
            onClick={toggleCopilotChat}
            sx={{ ml: 1 }}
          >
            <ChatBubbleOutlineIcon />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Header;
