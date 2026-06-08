import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const MESSAGES = [
  'Reading your resume...',
  'Matching with job requirements...',
  'Generating insights...',
  'Scoring your application...',
  'Almost there...',
];

interface AIAnalyzingProps {
  /** Override the cycling message list. */
  messages?: string[];
  /** How long each message shows in ms. Default 2000. */
  intervalMs?: number;
  /** Container min-height in px. Default 160. */
  minHeight?: number;
  /** Compact single-line inline mode (for use inside buttons / small spaces). */
  inline?: boolean;
}

export function AIAnalyzing({
  messages = MESSAGES,
  intervalMs = 2000,
  minHeight = 160,
  inline = false,
}: AIAnalyzingProps) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Fade-out → swap text → fade-in every intervalMs
    timerRef.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % messages.length);
        setVisible(true);
      }, 300); // matches the CSS transition duration
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [messages, intervalMs]);

  if (inline) {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
        }}
      >
        {/* Pulsing sparkle dots */}
        <Box sx={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #004ac6 0%, #712ae2 100%)',
                animation: 'ai-pulse-dot 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
                '@keyframes ai-pulse-dot': {
                  '0%, 80%, 100%': { transform: 'scale(0.7)', opacity: 0.5 },
                  '40%': { transform: 'scale(1)', opacity: 1 },
                },
              }}
            />
          ))}
        </Box>
        <Typography
          variant="caption"
          sx={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.3s ease',
            color: '#004ac6',
            fontWeight: 500,
          }}
        >
          {messages[index]}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      role="status"
      aria-label="AI is analyzing"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        gap: 2.5,
        py: 4,
      }}
    >
      {/* Animated brain / sparkle icon made from CSS */}
      <Box
        sx={{
          position: 'relative',
          width: 64,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Outer pulse ring */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid',
            borderColor: 'rgba(0, 74, 198, 0.25)',
            animation: 'ai-ring-pulse 2s ease-in-out infinite',
            '@keyframes ai-ring-pulse': {
              '0%, 100%': { transform: 'scale(1)', opacity: 0.8 },
              '50%': { transform: 'scale(1.18)', opacity: 0.3 },
            },
          }}
        />
        {/* Second ring, offset */}
        <Box
          sx={{
            position: 'absolute',
            inset: 8,
            borderRadius: '50%',
            border: '2px solid',
            borderColor: 'rgba(113, 42, 226, 0.3)',
            animation: 'ai-ring-pulse 2s ease-in-out infinite',
            animationDelay: '0.4s',
          }}
        />
        {/* Core gradient circle */}
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #004ac6 0%, #712ae2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 18px rgba(0, 74, 198, 0.35)',
            animation: 'ai-core-glow 2s ease-in-out infinite',
            '@keyframes ai-core-glow': {
              '0%, 100%': { boxShadow: '0 4px 18px rgba(0, 74, 198, 0.35)' },
              '50%': { boxShadow: '0 6px 28px rgba(113, 42, 226, 0.55)' },
            },
          }}
        >
          {/* Sparkle ✦ unicode inside the core */}
          <Typography
            component="span"
            sx={{
              fontSize: 18,
              lineHeight: 1,
              color: '#ffffff',
              userSelect: 'none',
              animation: 'ai-sparkle-spin 4s linear infinite',
              '@keyframes ai-sparkle-spin': {
                from: { transform: 'rotate(0deg)' },
                to: { transform: 'rotate(360deg)' },
              },
            }}
            aria-hidden="true"
          >
            ✦
          </Typography>
        </Box>
      </Box>

      {/* Orbiting dots */}
      <Box
        sx={{
          position: 'absolute',
          width: 64,
          height: 64,
          animation: 'ai-orbit 3s linear infinite',
          '@keyframes ai-orbit': {
            from: { transform: 'rotate(0deg)' },
            to: { transform: 'rotate(360deg)' },
          },
        }}
      >
        {[0, 120, 240].map((deg) => (
          <Box
            key={deg}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: `linear-gradient(135deg, #004ac6, #712ae2)`,
              opacity: 0.7,
              transform: `rotate(${deg}deg) translateX(32px) translateY(-50%)`,
            }}
          />
        ))}
      </Box>

      {/* Cycling message */}
      <Box sx={{ textAlign: 'center', px: 2 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: '#0b1c30',
            mb: 0.5,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(4px)',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
          }}
        >
          {messages[index]}
        </Typography>
        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
          AI is analyzing your application
        </Typography>
      </Box>

      {/* Progress bar shimmer */}
      <Box
        sx={{
          width: 200,
          height: 4,
          borderRadius: 2,
          backgroundColor: '#e2e8f0',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '40%',
            background: 'linear-gradient(90deg, transparent, #004ac6, #712ae2, transparent)',
            borderRadius: 2,
            animation: 'ai-shimmer 1.8s ease-in-out infinite',
            '@keyframes ai-shimmer': {
              '0%': { transform: 'translateX(-200%)' },
              '100%': { transform: 'translateX(600%)' },
            },
          }}
        />
      </Box>
    </Box>
  );
}

export default AIAnalyzing;
