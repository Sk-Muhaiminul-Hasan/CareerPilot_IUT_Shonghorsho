import { Outlet, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useState } from 'react';

import Sidebar, { DRAWER_WIDTH } from './Sidebar';
import { CopilotChat } from '@/components/assistant/CopilotChat';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';

function AppLayout() {
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const toggleCopilotChat = useChatStore((s) => s.toggleChat);
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const userInitial = (user?.email ?? 'U').charAt(0).toUpperCase();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>
      <Sidebar />

      {/* Top app bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          backgroundColor: 'background.paper',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={() => setSidebarOpen(true)}
            sx={{ mr: 2, display: { md: 'none' }, color: '#0b1c30' }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <img src="/auto-logo.png" alt="Auto" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            </Box>
            <Typography sx={{ fontWeight: 700, color: '#0b1c30' }}>CareerPilot</Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              aria-label="Toggle Career Copilot"
              onClick={toggleCopilotChat}
              sx={{
                p: 0.75,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #004ac6 0%, #712ae2 100%)',
                boxShadow: '0 4px 12px rgba(0, 74, 198, 0.25)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 16px rgba(113, 42, 226, 0.35)',
                },
              }}
            >
              <img
                src="/Auto_using_laptop-removebg-preview.png"
                alt="Career Copilot"
                style={{ width: 24, height: 24, objectFit: 'contain' }}
              />
            </IconButton>
            {user?.email && (
              <Typography
                variant="body2"
                sx={{ color: '#434655', display: { xs: 'none', sm: 'inline' } }}
              >
                {user.email}
              </Typography>
            )}
            <IconButton onClick={(event) => setAnchorEl(event.currentTarget)}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: '#004ac6', fontSize: '0.9rem' }}>
                {userInitial}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={!!anchorEl}
              onClose={() => setAnchorEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                  navigate('/settings');
                }}
              >
                <ListItemIcon>
                  <SettingsOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Settings</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Logout</ListItemText>
              </MenuItem>
            </Menu>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Main content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: 8, // toolbar height
          px: { xs: 2, md: 4 },
          py: { xs: 2, md: 3 },
        }}
      >
        <Outlet />
      </Box>

      {/* Global Career Copilot chat drawer (controlled by useChatStore) */}
      <CopilotChat />
    </Box>
  );
}

export default AppLayout;
