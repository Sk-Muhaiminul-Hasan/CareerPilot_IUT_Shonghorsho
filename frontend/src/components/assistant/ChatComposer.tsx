import React from 'react';
import { Box, IconButton, Stack, TextField, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import SendIcon from '@mui/icons-material/Send';

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

const iconButtonSx = {
  color: '#004ac6',
  '&:hover': { backgroundColor: 'rgba(0, 74, 198, 0.08)' },
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
  onOpenContextMenu,
  onOpenMentionSearch,
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
