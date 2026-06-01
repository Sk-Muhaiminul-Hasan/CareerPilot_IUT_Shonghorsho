import React, { useState, useRef, useEffect } from 'react';
import { Drawer, Box, Typography, TextField, IconButton, Paper, Stack, Chip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import WorkIcon from '@mui/icons-material/Work';
import DescriptionIcon from '@mui/icons-material/Description';
import { useChatStore } from '../../store/useChatStore';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
}

export const CopilotChat: React.FC = () => {
  
  const { isOpen, activeJobId, userProfileId, closeChat } = useChatStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'assistant',
      text: "Hi! I am your career copilot. Ask me things like 'Am I ready for this role?' or request a custom roadmap!",
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isOpen && activeJobId) {
      setMessages([
        {
          sender: 'assistant',
          text: '🔍 Analyzing your background against this specific position... One moment while I run a gap analysis.',
        },
      ]);

      // Automatically trigger the streaming handler with a hidden context-aware prompt
      triggerAutomatedEvaluation();
    }
  }, [activeJobId, isOpen]);
  
  const triggerAutomatedEvaluation = async () => {
    setIsTyping(true);
    setMessages((prev) => [...prev, { sender: 'assistant', text: '' }]);

    try {
      const response = await fetch('http://localhost:8000/api/v1/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:
            'Please perform a comprehensive review of my fitness for this role. What are my gaps and match score?',
          active_job_id: activeJobId,
          user_profile_id: userProfileId,
        }),
      });

      if (!response.body) throw new Error('Stream body missing');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              accumulatedText += parsed.text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { sender: 'assistant', text: accumulatedText };
                return updated;
              });
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setIsTyping(true);

    // Placeholder array index for incoming stream text chunks
    setMessages((prev) => [...prev, { sender: 'assistant', text: '' }]);

    try {
      const response = await fetch('http://localhost:8000/api/v1/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          active_job_id: activeJobId,
          user_profile_id: userProfileId,
        }),
      });

      if (!response.body) throw new Error('No readable response body');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedResponse = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const textChunk = decoder.decode(value, { stream: true });
        // Process standard text/event-stream chunks (data: {...})
        const lines = textChunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              accumulatedResponse += parsed.text;

              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { sender: 'assistant', text: accumulatedResponse };
                return updated;
              });
            } catch (e) {
              // Handle mid-chunk parsing offsets gracefully
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        { sender: 'assistant', text: 'Sorry, I lost connection to the server.' },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      variant="persistent"
      PaperProps={{ sx: { width: 380, display: 'flex', flexDirection: 'column' } }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <Typography variant="h6">Career Copilot</Typography>
        {activeJobId && (
          <Typography variant="caption" color="primary">
            Targeting Job Context Active
          </Typography>
        )}
        <IconButton onClick={closeChat} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Messages */}
      <Box sx={{ flexGrow: 1, p: 2, overflowY: 'auto', bgcolor: '#f9f9f9' }}>
        <Stack spacing={2}>
          {messages.map((msg, index) => (
            <Box
              key={index}
              sx={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}
            >
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
              </Paper>
            </Box>
          ))}
          <div ref={scrollRef} />
        </Stack>
      </Box>

      {/* Context Tagging Chip Tray */}
      {(activeJobId || userProfileId) && (
        <Box sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'flex', flexWrap: 'wrap', gap: 1, borderTop: '1px solid #e0e0e0' }}>
          {userProfileId && (
            <Chip
              icon={<DescriptionIcon fontSize="small" />}
              label={`Resume: ${userProfileId}`}
              variant="outlined"
              size="small"
              onDelete={() => useChatStore.setState({ userProfileId: null })}
              sx={{
                borderRadius: '16px',
                backgroundColor: 'rgba(25, 118, 210, 0.06)',
                borderColor: 'rgba(25, 118, 210, 0.15)',
                color: 'text.secondary',
                fontSize: '0.75rem',
                '& .MuiChip-icon': { color: 'primary.main' },
              }}
            />
          )}
          {activeJobId && (
            <Chip
              icon={<WorkIcon fontSize="small" />}
              label={`Job Context: ${activeJobId}`}
              variant="outlined"
              size="small"
              onDelete={() => useChatStore.setState({ activeJobId: null })}
              sx={{
                borderRadius: '16px',
                backgroundColor: 'rgba(76, 175, 80, 0.06)',
                borderColor: 'rgba(76, 175, 80, 0.15)',
                color: 'text.secondary',
                fontSize: '0.75rem',
                '& .MuiChip-icon': { color: 'success.main' },
              }}
            />
          )}
        </Box>
      )}

      {/* Input */}
      <Box sx={{ p: 2, borderTop: (activeJobId || userProfileId) ? 'none' : '1px solid #e0e0e0', display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Ask me anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
        />
        <IconButton color="primary" onClick={handleSendMessage} disabled={isTyping}>
          <SendIcon />
        </IconButton>
      </Box>
    </Drawer>
  );
};
