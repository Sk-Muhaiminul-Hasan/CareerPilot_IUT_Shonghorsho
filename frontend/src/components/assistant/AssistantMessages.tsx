import React from 'react';
import { Box, Chip, Paper, Stack, Tooltip, Typography } from '@mui/material';
import type { ChatSource } from '@/types/chat';

export interface AssistantMessage {
  sender: 'user' | 'assistant';
  text: string;
  sources?: ChatSource[];
}

interface AssistantMessagesProps {
  messages: AssistantMessage[];
  isTyping: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  onOpenSource: (source: ChatSource) => void;
}

export const AssistantMessages: React.FC<AssistantMessagesProps> = ({
  messages,
  isTyping,
  scrollRef,
  onOpenSource,
}) => (
  <Box sx={{ flexGrow: 1, p: 2, overflowY: 'auto', bgcolor: '#f7f8fa' }}>
    <Stack spacing={2}>
      {messages.map((msg, index) => (
        <Box key={index} sx={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
          <Paper
            sx={{
              p: 1.5,
              bgcolor: msg.sender === 'user' ? 'primary.main' : 'white',
              color: msg.sender === 'user' ? 'white' : 'text.primary',
              borderRadius: 2,
            }}
          >
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {msg.text}
            </Typography>
            {msg.sources && msg.sources.length > 0 && (
              <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                {msg.sources.slice(0, 3).map((source) => (
                  <Tooltip key={source.id} title={source.text}>
                    <Chip size="small" label={source.id} onClick={() => onOpenSource(source)} />
                  </Tooltip>
                ))}
              </Stack>
            )}
          </Paper>
        </Box>
      ))}
      {isTyping && (
        <Typography variant="caption" color="text.secondary">
          Thinking...
        </Typography>
      )}
      <div ref={scrollRef} />
    </Stack>
  </Box>
);
