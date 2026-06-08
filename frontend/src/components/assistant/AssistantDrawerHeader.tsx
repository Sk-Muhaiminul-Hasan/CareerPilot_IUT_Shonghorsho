import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddCommentIcon from '@mui/icons-material/AddComment';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import WorkIcon from '@mui/icons-material/Work';

interface AssistantDrawerHeaderProps {
  activeJobId: string | null;
  historyOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onToggleHistory: () => void;
}

export function AssistantDrawerHeader({
  activeJobId,
  historyOpen,
  onClose,
  onNewChat,
  onToggleHistory,
}: AssistantDrawerHeaderProps) {
  return (
    <Box
      sx={{
        position: 'relative',
        px: 2.25,
        py: 2,
        background: 'linear-gradient(135deg, #004ac6 0%, #712ae2 100%)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2,
          backgroundColor: 'rgba(255, 255, 255, 0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
          boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.25)',
        }}
      >
        <img
          src="/Auto_using_laptop-removebg-preview.png"
          alt="Career Copilot"
          style={{ width: 32, height: 32, objectFit: 'contain' }}
        />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2, color: '#ffffff' }}>
          Career Copilot
        </Typography>

      </Box>
      {activeJobId && (
        <Chip
          icon={<WorkIcon sx={{ color: '#004ac6 !important' }} />}
          label="Job"
          size="small"
          sx={{ backgroundColor: '#ffffff', color: '#004ac6', fontWeight: 600 }}
        />
      )}
      <HeaderButton title="New chat" onClick={onNewChat}>
        <AddCommentIcon fontSize="small" />
      </HeaderButton>
      <HeaderButton title={historyOpen ? 'Hide history' : 'Show history'} onClick={onToggleHistory}>
        <HistoryIcon fontSize="small" />
      </HeaderButton>
      <HeaderButton title="Close" onClick={onClose}>
        <CloseIcon fontSize="small" />
      </HeaderButton>
    </Box>
  );
}

function HeaderButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip title={title}>
      <IconButton
        onClick={onClick}
        size="small"
        sx={{
          color: '#ffffff',
          backgroundColor: 'rgba(255, 255, 255, 0.12)',
          '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.24)' },
        }}
      >
        {children}
      </IconButton>
    </Tooltip>
  );
}
