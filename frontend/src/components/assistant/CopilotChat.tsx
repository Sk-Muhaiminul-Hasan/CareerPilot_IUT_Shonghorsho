import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Chip,
  Drawer,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import SendIcon from '@mui/icons-material/Send';
import WorkIcon from '@mui/icons-material/Work';

import { sendChatMessage } from '@/services/chatService';
import { useChatStore } from '@/store/useChatStore';
import type { ChatArtifact, ChatAttachment, ChatSource } from '@/types/chat';
import { AssistantContextMenu } from './AssistantContextMenu';
import { ArtifactPanel } from './ArtifactPanel';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
  sources?: ChatSource[];
}

interface StoredArtifact extends ChatArtifact {
  id: string;
}

export const CopilotChat: React.FC = () => {
  const { isOpen, activeJobId, userProfileId, closeChat } = useChatStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'assistant',
      text: "Hi, I already have your CV context when it is available. Ask about readiness, gaps, roadmaps, or cover letters.",
    },
  ]);
  const [input, setInput] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [showJobDescription, setShowJobDescription] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [artifacts, setArtifacts] = useState<StoredArtifact[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const shouldShowJobDescription =
    showJobDescription ||
    Boolean(jobDescription.trim()) ||
    (!activeJobId && /\b(ready|cover letter|posting|job description|role)\b/i.test(input));

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && activeJobId) {
      void sendAutomatedEvaluation();
    }
  }, [activeJobId, isOpen]);

  const addAttachment = (attachment: ChatAttachment) => {
    setAttachments((current) => {
      if (current.some((item) => item.type === attachment.type && item.label === attachment.label)) {
        return current;
      }
      return [...current, attachment];
    });
    setMenuAnchor(null);
  };

  const addArtifacts = (items: ChatArtifact[]) => {
    if (items.length === 0) return;
    const stamp = Date.now();
    setArtifacts((current) => [
      ...items.map((item, index) => ({ ...item, id: `${stamp}-${index}` })),
      ...current,
    ].slice(0, 10));
  };

  const sendAutomatedEvaluation = async () => {
    setIsTyping(true);
    setMessages([
      {
        sender: 'assistant',
        text: 'Analyzing your background against this saved job context...',
      },
    ]);
    try {
      const response = await sendChatMessage({
        query: 'Please review my fitness for this role. What are my gaps and match score?',
        active_job_id: activeJobId,
        user_profile_id: userProfileId,
        attachments,
      });
      setMessages((current) => [
        ...current,
        { sender: 'assistant', text: response.answer, sources: response.sources },
      ]);
      addArtifacts(response.artifacts);
    } catch {
      setMessages((current) => [
        ...current,
        { sender: 'assistant', text: 'Sorry, I could not reach the assistant API.' },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((current) => [...current, { sender: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const response = await sendChatMessage({
        query: userMsg,
        active_job_id: activeJobId,
        user_profile_id: userProfileId,
        job_description: jobDescription.trim() || undefined,
        attachments,
      });
      setMessages((current) => [
        ...current,
        { sender: 'assistant', text: response.answer, sources: response.sources },
      ]);
      addArtifacts(response.artifacts);
    } catch {
      setMessages((current) => [
        ...current,
        { sender: 'assistant', text: 'Sorry, I could not reach the assistant API.' },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      variant="persistent"
      PaperProps={{ sx: { width: 380, display: 'flex', flexDirection: 'column' } }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #e0e0e0' }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Career Copilot
        </Typography>
        {activeJobId && <Chip icon={<WorkIcon />} label="Job" size="small" color="success" />}
        <IconButton onClick={closeChat} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

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
                        <Chip size="small" label={source.id} />
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

      <ArtifactPanel artifacts={artifacts} />

      {(attachments.length > 0 || activeJobId || userProfileId) && (
        <Box sx={{ px: 2, py: 1, display: 'flex', flexWrap: 'wrap', gap: 1, borderTop: '1px solid #e0e0e0' }}>
          {userProfileId && (
            <Chip icon={<DescriptionIcon />} label={userProfileId === 'default_user' ? 'Demo CV' : userProfileId} size="small" />
          )}
          {attachments.map((attachment, index) => (
            <Chip
              key={`${attachment.type}-${attachment.label}`}
              label={attachment.label}
              size="small"
              onDelete={() => removeAttachment(index)}
            />
          ))}
        </Box>
      )}

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
              onChange={(event) => setJobDescription(event.target.value)}
            />
          )}
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Tooltip title="Add context">
              <IconButton size="small" onClick={(event) => setMenuAnchor(event.currentTarget)}>
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Mention context">
              <IconButton size="small" onClick={(event) => setMenuAnchor(event.currentTarget)}>
                <AlternateEmailIcon />
              </IconButton>
            </Tooltip>
            <TextField
              fullWidth
              size="small"
              placeholder="Ask me anything..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && handleSendMessage()}
            />
            <IconButton color="primary" onClick={handleSendMessage} disabled={isTyping}>
              <SendIcon />
            </IconButton>
          </Box>
        </Stack>
      </Box>

      <AssistantContextMenu
        anchorEl={menuAnchor}
        activeJobId={activeJobId}
        userProfileId={userProfileId}
        onAddAttachment={addAttachment}
        onClose={() => setMenuAnchor(null)}
        onShowJobDescription={() => {
          setShowJobDescription(true);
          setMenuAnchor(null);
        }}
      />
    </Drawer>
  );
};
