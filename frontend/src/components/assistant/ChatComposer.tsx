import React from 'react';
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import ScreenSearchDesktopOutlinedIcon from '@mui/icons-material/ScreenSearchDesktopOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import type { ContextOption } from './contextOptions';

interface ChatComposerProps {
  input: string;
  jobDescription: string;
  isTyping: boolean;
  shouldShowJobDescription: boolean;
  inputRef: React.Ref<HTMLInputElement>;
  onInputChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onInputKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onJobDescriptionChange: (value: string) => void;
  onOpenContextMenu: (anchor: HTMLElement) => void;
  onOpenMentionSearch: () => void;
  onSend: () => void;
  // Passed directly so we can render a styled inline menu
  contextOptions?: ContextOption[];
  onSelectContextOption?: (option: ContextOption) => void;
}

/** Pick a small icon for each context option by id */
function optionIcon(id: string): React.ReactElement {
  switch (id) {
    case 'current-screen':
      return <ScreenSearchDesktopOutlinedIcon fontSize="small" />;
    case 'active-cv':
      return <ArticleOutlinedIcon fontSize="small" />;
    case 'current-job':
      return <WorkOutlineIcon fontSize="small" />;
    case 'job-description':
      return <DescriptionOutlinedIcon fontSize="small" />;
    case 'benchmark-analyser':
      return <CompareArrowsIcon fontSize="small" />;
    default:
      return <LayersOutlinedIcon fontSize="small" />;
  }
}

const textFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 9999,
    backgroundColor: '#ffffff',
    '& fieldset': { borderColor: '#c3c6d7' },
    '&:hover fieldset': { borderColor: '#004ac6' },
    '&.Mui-focused fieldset': {
      borderColor: '#004ac6',
      borderWidth: 2,
      boxShadow: '0 0 0 4px rgba(0, 74, 198, 0.12)',
    },
  },
} as const;

export const ChatComposer: React.FC<ChatComposerProps> = ({
  input,
  jobDescription,
  isTyping,
  shouldShowJobDescription,
  inputRef,
  onInputChange,
  onInputKeyDown,
  onJobDescriptionChange,
  onSend,
}) => (
  <Box
    sx={{
      p: 1.5,
      borderTop: '1px solid #c3c6d7',
      backgroundColor: '#ffffff',
      boxShadow: '0 -2px 12px rgba(11, 28, 48, 0.04)',
      flexShrink: 0,
    }}
  >
    <Stack spacing={1}>
      {shouldShowJobDescription && (
        <TextField
          fullWidth
          multiline
          minRows={3}
          maxRows={6}
          size="small"
          placeholder="Paste job description..."
          value={jobDescription}
          onChange={(event) => onJobDescriptionChange(event.target.value)}
          sx={textFieldSx}
        />
      )}
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <Tooltip title="Add context">
          <IconButton size="small" onClick={(event) => onOpenContextMenu(event.currentTarget)} sx={iconButtonSx}>
            <AddIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Mention context">
          <IconButton size="small" onClick={onOpenMentionSearch} sx={iconButtonSx}>
            <AlternateEmailIcon />
          </IconButton>
        </Tooltip>
        <TextField
          fullWidth
          size="small"
          placeholder="Ask me anything..."
          value={input}
          inputRef={inputRef}
          onChange={onInputChange}
          onKeyDown={onInputKeyDown}
          sx={textFieldSx}
        />
        <Tooltip title={isTyping ? 'Sending...' : 'Send'}>
          <span>
            <IconButton
              size="small"
              onClick={handleOpenMenu}
              aria-label="Add context"
              sx={{
                color: '#004ac6',
                '&:hover': { backgroundColor: 'rgba(0, 74, 198, 0.08)' },
              }}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>

          {/* Compact context popover */}
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={handleCloseMenu}
            anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            PaperProps={{
              elevation: 4,
              sx: {
                mt: -0.5,
                minWidth: 240,
                maxWidth: 280,
                borderRadius: 2,
                border: '1px solid #e2e8f0',
                boxShadow: '0 8px 24px rgba(11, 28, 48, 0.12)',
                overflow: 'hidden',
                '& .MuiList-root': { py: 0.5 },
              },
            }}
          >
            {/* Popover header */}
            <Box
              sx={{
                px: 1.5,
                py: 1,
                borderBottom: '1px solid #f0f2f8',
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color: '#737686', textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                Add context
              </Typography>
            </Box>

            {contextOptions.map((option) => (
              <MenuItem
                key={option.id}
                disabled={option.disabled}
                onClick={() => handleSelect(option)}
                dense
                sx={{
                  px: 1.5,
                  py: 0.75,
                  gap: 1,
                  '&:hover': { backgroundColor: '#f0f4ff' },
                  '&.Mui-disabled': { opacity: 0.45 },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 'auto',
                    color: option.disabled ? 'text.disabled' : '#004ac6',
                  }}
                >
                  {optionIcon(option.id)}
                </ListItemIcon>
                <ListItemText
                  primary={option.label}
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: 500,
                    color: option.disabled ? 'text.disabled' : '#0b1c30',
                    noWrap: true,
                  }}
                />
              </MenuItem>
            ))}
          </Menu>

          <TextField
            fullWidth
            size="small"
            placeholder="Ask me anything..."
            value={input}
            inputRef={inputRef}
            onChange={onInputChange}
            onKeyDown={onInputKeyDown}
            sx={textFieldSx}
          />

          <Tooltip title={isTyping ? 'Sending...' : 'Send'}>
            <span>
              <IconButton
                onClick={onSend}
                disabled={isTyping}
                sx={{
                  ml: 0.5,
                  color: '#ffffff',
                  background: 'linear-gradient(135deg, #004ac6 0%, #712ae2 100%)',
                  boxShadow: '0 4px 10px rgba(0, 74, 198, 0.25)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #003aa3 0%, #5d22bd 100%)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 6px 14px rgba(113, 42, 226, 0.32)',
                  },
                  '&.Mui-disabled': {
                    background: '#c3c6d7',
                    color: '#ffffff',
                    boxShadow: 'none',
                  },
                }}
              >
                <SendIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Stack>
    </Box>
  );
};
