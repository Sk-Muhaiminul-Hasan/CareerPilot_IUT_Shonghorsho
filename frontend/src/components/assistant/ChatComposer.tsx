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
import CloseIcon from '@mui/icons-material/Close';
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
  onCloseJobDescription?: () => void;
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
  contextOptions = [],
  onSelectContextOption,
  onCloseJobDescription,
}) => {
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [isEditingJobDesc, setIsEditingJobDesc] = React.useState(true);

  React.useEffect(() => {
    if (!jobDescription) {
      setIsEditingJobDesc(true);
    }
  }, [jobDescription]);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
  };

  const handleSelect = (option: ContextOption) => {
    onSelectContextOption?.(option);
    handleCloseMenu();
  };

  return (
    <Box
      sx={{
        p: 1.5,
        borderTop: '1px solid #c3c6d7',
        backgroundColor: '#ffffff',
        boxShadow: '0 -2px 12px rgba(11, 28, 48, 0.04)',
      }}
    >
      <Stack spacing={1}>
        {shouldShowJobDescription && (
          isEditingJobDesc ? (
            <Box sx={{ position: 'relative', width: '100%' }}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                maxRows={6}
                size="small"
                autoFocus
                placeholder="Paste job description..."
                value={jobDescription}
                onChange={(event) => onJobDescriptionChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (jobDescription.trim()) {
                      setIsEditingJobDesc(false);
                    }
                  }
                }}
                sx={{
                  ...textFieldSx,
                  '& .MuiOutlinedInput-root': {
                    ...textFieldSx['& .MuiOutlinedInput-root'],
                    pr: 5,
                  }
                }}
              />
              <IconButton
                size="small"
                onClick={onCloseJobDescription}
                aria-label="Remove job description"
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  color: '#737686',
                  '&:hover': {
                    color: '#ff4d4f',
                    backgroundColor: 'rgba(255, 77, 79, 0.08)',
                  },
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Box
              onClick={() => setIsEditingJobDesc(true)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 0.75,
                borderRadius: '16px',
                border: '1px solid #c3c6d7',
                backgroundColor: '#f5f7ff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                alignSelf: 'flex-start',
                maxWidth: 'fit-content',
                boxShadow: '0 2px 6px rgba(0, 74, 198, 0.04)',
                '&:hover': {
                  backgroundColor: '#eef2ff',
                  borderColor: '#004ac6',
                  boxShadow: '0 4px 12px rgba(0, 74, 198, 0.08)',
                },
              }}
            >
              <DescriptionOutlinedIcon fontSize="small" sx={{ color: '#004ac6' }} />
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  color: '#0b1c30',
                  fontSize: '0.85rem',
                  userSelect: 'none',
                }}
              >
                {(() => {
                  const words = jobDescription.trim().split(/\s+/);
                  if (words.length <= 2) {
                    return jobDescription.trim();
                  }
                  return `${words[0]} ${words[1]}...`;
                })()}
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseJobDescription?.();
                }}
                aria-label="Remove job description"
                sx={{
                  p: 0.25,
                  color: '#737686',
                  '&:hover': {
                    color: '#ff4d4f',
                    backgroundColor: 'rgba(255, 77, 79, 0.08)',
                  },
                }}
              >
                <CloseIcon sx={{ fontSize: '0.9rem' }} />
              </IconButton>
            </Box>
          )
        )}

        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {/* Single "+" button that opens the compact context popover */}
          <Tooltip title="Add context">
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
