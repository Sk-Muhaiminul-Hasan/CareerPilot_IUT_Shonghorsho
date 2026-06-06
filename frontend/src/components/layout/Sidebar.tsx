import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import BoltIcon from '@mui/icons-material/Bolt';

import { useAppStore } from '@/store/useAppStore';

export const DRAWER_WIDTH = 240;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactElement;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <GridViewRoundedIcon /> },
  { label: 'Job Search', path: '/jobs', icon: <WorkOutlineIcon /> },
  { label: 'Applications', path: '/applications', icon: <SendOutlinedIcon /> },
  { label: 'Resumes', path: '/resumes', icon: <DescriptionOutlinedIcon /> },
  { label: 'Analytics', path: '/analytics', icon: <BarChartOutlinedIcon /> },
  { label: 'Settings', path: '/settings', icon: <SettingsOutlinedIcon /> },
];

function DrawerContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo area */}
      <Box
        sx={{
          px: 2.5,
          py: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #004ac6 0%, #712ae2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <BoltIcon sx={{ color: '#fff', fontSize: 20 }} />
        </Box>
        <Box>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: '1rem',
              color: '#0b1c30',
              lineHeight: 1.2,
            }}
          >
            CareerPilot AI
          </Typography>
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: '#737686',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            Career Accountable
          </Typography>
        </Box>
      </Box>

      {/* Nav items */}
      <List sx={{ px: 1.5, pt: 1.5, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const selected = location.pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={selected}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  px: 1.5,
                  py: 1,
                  '& .MuiListItemIcon-root': {
                    color: selected ? '#ffffff' : '#737686',
                    minWidth: 36,
                    transition: 'color 0.15s',
                  },
                  '& .MuiListItemText-primary': {
                    fontWeight: selected ? 600 : 500,
                    fontSize: '0.9rem',
                    color: selected ? '#ffffff' : '#0b1c30',
                    transition: 'color 0.15s',
                  },
                  '&.Mui-selected': {
                    backgroundColor: '#004ac6',
                    '&:hover': {
                      backgroundColor: '#003ea8',
                    },
                  },
                  '&:not(.Mui-selected):hover': {
                    backgroundColor: '#eff4ff',
                    '& .MuiListItemIcon-root': { color: '#004ac6' },
                    '& .MuiListItemText-primary': { color: '#004ac6' },
                  },
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}

function Sidebar() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  return (
    <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: 0 }}>
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
      >
        <DrawerContent />
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
        open
      >
        <DrawerContent />
      </Drawer>
    </Box>
  );
}

export default Sidebar;
