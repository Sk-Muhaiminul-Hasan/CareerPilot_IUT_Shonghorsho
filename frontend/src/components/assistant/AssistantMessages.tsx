import React from 'react';
import { Box, Chip, Paper, Stack, Tooltip } from '@mui/material';
import type { ChatSource, ChatUiMessage } from '@/types/chat';
import { AssistantMarkdown } from './AssistantMarkdown';

interface AssistantMessagesProps {
  messages: ChatUiMessage[];
  isTyping: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  onOpenSource: (source: ChatSource) => void;
}

const userBubbleSx = {
  p: 1.5,
  color: '#ffffff',
  background: 'linear-gradient(135deg, #004ac6 0%, #712ae2 100%)',
  borderRadius: '20px 20px 4px 20px',
  boxShadow: '0 4px 12px rgba(0, 74, 198, 0.18)',
} as const;

const assistantBubbleSx = {
  p: 1.5,
  backgroundColor: '#ffffff',
  color: '#0b1c30',
  borderRadius: '20px 20px 20px 4px',
  borderLeft: '3px solid #004ac6',
  boxShadow: '0 2px 8px rgba(11, 28, 48, 0.06)',
} as const;

const TypingDots: React.FC = () => (
  <Box
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.5,
      px: 1.5,
      py: 1,
      backgroundColor: '#ffffff',
      borderRadius: '20px 20px 20px 4px',
      borderLeft: '3px solid #004ac6',
      boxShadow: '0 2px 8px rgba(11, 28, 48, 0.06)',
    }}
    aria-label="Career Copilot is typing"
  >
    {[0, 1, 2].map((index) => (
      <Box
        key={index}
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #004ac6 0%, #712ae2 100%)',
          opacity: 0.7,
          animation: 'copilot-typing 1.2s ease-in-out infinite',
          animationDelay: `${index * 0.15}s`,
          '@keyframes copilot-typing': {
            '0%, 80%, 100%': { transform: 'translateY(0)', opacity: 0.4 },
            '40%': { transform: 'translateY(-4px)', opacity: 1 },
          },
        }}
      />
    ))}
  </Box>
);

export const AssistantMessages: React.FC<AssistantMessagesProps> = ({
  messages,
  isTyping,
  scrollRef,
  onOpenSource,
}) => (
  <Box sx={{ flexGrow: 1, minHeight: 0, p: 2, overflowY: 'auto', backgroundColor: '#f8f9ff' }}>
    <Stack spacing={1.5}>
      {messages.map((msg, index) => {
        const isUser = msg.sender === 'user';
        return (
          <Box
            key={msg.id || index}
            sx={{
              alignSelf: isUser ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: isUser ? 'flex-end' : 'flex-start',
            }}
          >
            <Paper elevation={0} sx={isUser ? userBubbleSx : assistantBubbleSx}>
              <AssistantMarkdown text={msg.text} invert={isUser} />
              {msg.sources && msg.sources.length > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                  {msg.sources.slice(0, 3).map((source) => (
                    <Tooltip key={source.id} title={source.text}>
                      <Chip
                        size="small"
                        label={source.id}
                        onClick={() => onOpenSource(source)}
                        sx={{
                          backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0, 74, 198, 0.08)',
                          color: isUser ? '#ffffff' : '#004ac6',
                          fontWeight: 600,
                          '&:hover': {
                            backgroundColor: isUser ? 'rgba(255,255,255,0.3)' : 'rgba(0, 74, 198, 0.16)',
                          },
                        }}
                      />
                    </Tooltip>
                  ))}
                </Stack>
              )}
            </Paper>
          </Box>
        );
      })}
      {isTyping && (
        <Box sx={{ alignSelf: 'flex-start' }}>
          <TypingDots />
        </Box>
      )}
      <div ref={scrollRef} />
    </Stack>
  </Box>
);
