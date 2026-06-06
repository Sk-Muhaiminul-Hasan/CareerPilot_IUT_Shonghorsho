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
  <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
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
        />
      )}
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <Tooltip title="Add context">
          <IconButton size="small" onClick={(event) => onOpenContextMenu(event.currentTarget)}>
            <AddIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Mention context">
          <IconButton size="small" onClick={onOpenMentionSearch}>
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
        />
        <IconButton color="primary" onClick={onSend} disabled={isTyping}>
          <SendIcon />
        </IconButton>
      </Box>
    </Stack>
  </Box>
);
