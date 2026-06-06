import { createTheme } from '@mui/material/styles';

/** Kinetic Accountability design system — see Designs/DESIGN.md */
const theme = createTheme({
  palette: {
    primary: {
      main: '#004ac6',
      light: '#2563eb',
      dark: '#003ea8',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#712ae2',
      light: '#8a4cfc',
      dark: '#5a00c6',
      contrastText: '#ffffff',
    },
    error: {
      main: '#ba1a1a',
    },
    background: {
      default: '#f8f9ff',
      paper: '#ffffff',
    },
    text: {
      primary: '#0b1c30',
      secondary: '#434655',
    },
    divider: '#c3c6d7',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700, letterSpacing: '-0.01em' },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
    body1: { fontSize: '1rem', lineHeight: 1.5 },
    body2: { fontSize: '0.875rem', lineHeight: 1.43 },
    caption: { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: '1px solid #e2e8f0',
          borderRadius: 24,
          boxShadow: '0 4px 12px rgba(11, 28, 48, 0.05)',
          transition: 'box-shadow 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 8px 24px rgba(11, 28, 48, 0.09)',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 8,
        },
        contained: {
          boxShadow: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.72rem',
          letterSpacing: '0.04em',
          borderRadius: 9999,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 9999,
          height: 12,
          backgroundColor: '#e5eeff',
        },
        bar: {
          borderRadius: 9999,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

export default theme;
