import React from 'react';
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import type { ChatSource, ChatUiMessage } from '@/types/chat';
import { AssistantMarkdown } from './AssistantMarkdown';

interface AssistantMessagesProps {
  messages: ChatUiMessage[];
  isTyping: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  onOpenSource: (source: ChatSource) => void;
}

/** Animated typing indicator — three bouncing dots */
const TypingDots: React.FC = () => (
  <Box
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      py: 0.5,
    }}
    aria-label="Career Copilot is typing"
  >
    {[0, 1, 2].map((i) => (
      <Box
        key={i}
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #004ac6 0%, #712ae2 100%)',
          opacity: 0.75,
          animation: 'copilot-typing 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.16}s`,
          '@keyframes copilot-typing': {
            '0%, 80%, 100%': { transform: 'translateY(0)', opacity: 0.4 },
            '40%': { transform: 'translateY(-5px)', opacity: 1 },
          },
        }}
      />
    ))}
  </Box>
);

/** Small gradient avatar shown beside bot messages */
const BotAvatar: React.FC = () => (
  <Box
    sx={{
      width: 28,
      height: 28,
      borderRadius: '8px',
      background: 'linear-gradient(135deg, #004ac6 0%, #712ae2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      mt: 0.25,
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,74,198,0.25)',
    }}
  >
    <img
      src="/Auto_using_laptop-removebg-preview.png"
      alt="Copilot"
      style={{ width: 18, height: 18, objectFit: 'contain' }}
    />
  </Box>
);

export const AssistantMessages: React.FC<AssistantMessagesProps> = ({
  messages,
  isTyping,
  scrollRef,
  onOpenSource,
}) => (
  <Box
    sx={{
      flexGrow: 1,
      minHeight: 0,
      overflowY: 'auto',
      backgroundColor: '#f8f9ff',
      // thin custom scrollbar
      '&::-webkit-scrollbar': { width: 4 },
      '&::-webkit-scrollbar-track': { background: 'transparent' },
      '&::-webkit-scrollbar-thumb': {
        background: 'rgba(0,74,198,0.18)',
        borderRadius: 4,
      },
    }}
  >
    <Stack spacing={0}>
      {messages.map((msg, index) => {
        const isUser = msg.sender === 'user';

        if (isUser) {
          /* ── User message — right-aligned pill ─────────────────────────── */
          return (
            <Box
              key={msg.id || index}
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                px: 2,
                pt: index === 0 ? 2 : 1.5,
                pb: 0,
              }}
            >
              <Box
                sx={{
                  maxWidth: '80%',
                  px: 2,
                  py: 1.25,
                  background: 'linear-gradient(135deg, #004ac6 0%, #712ae2 100%)',
                  color: '#ffffff',
                  borderRadius: '18px 18px 4px 18px',
                  boxShadow: '0 3px 10px rgba(0,74,198,0.22)',
                  fontSize: '0.875rem',
                  lineHeight: 1.55,
                }}
              >
                <AssistantMarkdown text={msg.text} invert />
              </Box>
            </Box>
          );
        }

        /* ── Bot message — full-width, no bubble ───────────────────────── */
        return (
          <Box
            key={msg.id || index}
            sx={{
              px: 2,
              pt: index === 0 ? 2 : 2,
              pb: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              // subtle separator between consecutive bot messages
              borderTop: index > 0 && messages[index - 1]?.sender !== 'user'
                ? '1px solid rgba(194,200,220,0.35)'
                : 'none',
            }}
          >
            {/* Avatar row */}
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <BotAvatar />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: '#004ac6',
                  letterSpacing: 0.2,
                  mt: '5px',
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                }}
              >
                Career Copilot
              </Typography>
            </Stack>

            {/* Message body — full width, no bubble */}
            <Box
              sx={{
                pl: '40px', // align with text beside avatar
                pr: 0,
                pb: 2,
                color: '#1a2740',
                fontSize: '0.875rem',
                lineHeight: 1.7,
                '& p': { my: 0.5 },
                '& ul, & ol': { pl: 2.5, my: 0.5 },
                '& li': { mb: 0.25 },
              }}
            >
              <AssistantMarkdown text={msg.text} invert={false} />

              {/* Source chips */}
              {msg.sources && msg.sources.length > 0 && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ mt: 1.25, flexWrap: 'wrap', gap: 0.5 }}
                >
                  {msg.sources.slice(0, 3).map((source) => (
                    <Tooltip key={source.id} title={source.text}>
                      <Chip
                        size="small"
                        label={source.id}
                        onClick={() => onOpenSource(source)}
                        sx={{
                          backgroundColor: 'rgba(0,74,198,0.08)',
                          color: '#004ac6',
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          height: 22,
                          '&:hover': { backgroundColor: 'rgba(0,74,198,0.16)' },
                        }}
                      />
                    </Tooltip>
                  ))}
                </Stack>
              )}
            </Box>
          </Box>
        );
      })}

      {/* Typing indicator */}
      {isTyping && (
        <Box
          sx={{
            px: 2,
            pt: 1.5,
            pb: 1.5,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <BotAvatar />
            <TypingDots />
          </Stack>
        </Box>
      )}

      <div ref={scrollRef} />
    </Stack>
  </Box>
);
