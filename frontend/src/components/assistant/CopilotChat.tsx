import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Chip, Drawer, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WorkIcon from '@mui/icons-material/Work';

import { sendChatMessage } from '@/services/chatService';
import { useArtifactStore } from '@/store/useArtifactStore';
import { useChatStore } from '@/store/useChatStore';
import type { ChatAttachment, ChatMessage, ChatSource } from '@/types/chat';
import { AssistantContextMenu } from './AssistantContextMenu';
import { AssistantMessages, type AssistantMessage } from './AssistantMessages';
import { AttachmentChips } from './AttachmentChips';
import { ArtifactPanel } from './ArtifactPanel';
import { ChatComposer } from './ChatComposer';
import { MentionMenu } from './MentionMenu';
import { artifactContextOptions } from './artifactContextOptions';
import { buildContextOptions, type ContextOption } from './contextOptions';

export const CopilotChat: React.FC = () => {
  const { isOpen, activeJobId, userProfileId, closeChat } = useChatStore();
  const navigate = useNavigate();
  const location = useLocation();
  const artifacts = useArtifactStore((s) => s.artifacts);
  const addArtifacts = useArtifactStore((s) => s.addArtifacts);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { sender: 'assistant', text: "Hey, I'm here." },
  ]);
  const [input, setInput] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [showJobDescription, setShowJobDescription] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState<HTMLElement | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const greetingLoadedRef = useRef(false);

  const shouldShowJobDescription =
    showJobDescription ||
    Boolean(jobDescription.trim()) ||
    (!activeJobId && /\b(ready|cover letter|posting|job description|role)\b/i.test(input));
  const attachedResumeId =
    attachments.find((attachment) => attachment.type === 'resume')?.value || userProfileId;
  const contextOptions: ContextOption[] = buildContextOptions({
    activeJobId,
    userProfileId,
    screenPath: location.pathname,
  }).concat(artifactContextOptions(artifacts));

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!isOpen || activeJobId || greetingLoadedRef.current) return;
    greetingLoadedRef.current = true;
    void loadPersonalGreeting();
  }, [activeJobId, isOpen]);

  useEffect(() => {
    if (isOpen && activeJobId) {
      greetingLoadedRef.current = true;
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

  const selectContextOption = (option: ContextOption) => {
    if (option.action === 'job_description') {
      setShowJobDescription(true);
    }
    if (option.action === 'benchmark_prompt') {
      setInput((current) =>
        current.trim()
          ? `${current.trim()} Compare me against `
          : 'What skills am I missing compared with ',
      );
      inputRef.current?.focus();
    }
    if (option.attachment) {
      addAttachment(option.attachment);
    }
    setMenuAnchor(null);
  };

  const recentHistory = (): ChatMessage[] =>
    messages.slice(-6).map((message) => ({
      role: message.sender,
      content: message.text,
    }));

  const loadPersonalGreeting = async () => {
    setIsTyping(true);
    try {
      const response = await sendChatMessage({
        query:
          'Give me a short friendly opening using my CV context. One sentence only, then three tiny suggested prompts.',
        user_profile_id: attachedResumeId,
        attachments: contextOptions
          .filter((option) => option.id === 'current-screen' || option.id === 'active-cv')
          .map((option) => option.attachment)
          .filter((attachment): attachment is ChatAttachment => Boolean(attachment)),
      });
      setMessages([{ sender: 'assistant', text: response.answer, sources: response.sources }]);
      addArtifacts(response.artifacts);
    } catch {
      setMessages([
        {
          sender: 'assistant',
          text: 'Hey, I can use your latest CV automatically. Ask me about fit, gaps, roadmaps, or letters.',
        },
      ]);
    } finally {
      setIsTyping(false);
    }
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
        user_profile_id: attachedResumeId,
        attachments,
        conversation_history: recentHistory(),
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
        user_profile_id: attachedResumeId,
        job_description: jobDescription.trim() || undefined,
        attachments,
        conversation_history: recentHistory(),
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

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    const mention = value.match(/(?:^|\s)@([\w -]*)$/);
    setInput(value);
    if (mention) {
      setMentionQuery(mention[1]);
      setMentionAnchor(inputRef.current);
    } else {
      setMentionAnchor(null);
    }
  };

  const openMentionSearch = () => {
    setInput((current) => {
      if (!current || current.endsWith(' ') || current.endsWith('@')) return `${current}@`;
      return `${current} @`;
    });
    setMentionQuery('');
    setMentionAnchor(inputRef.current);
    inputRef.current?.focus();
  };

  const selectMention = (option: ContextOption) => {
    selectContextOption(option);
    setInput((current) => current.replace(/(?:^|\s)@[\w -]*$/, ` @${option.insertText} `).trimStart());
    setMentionAnchor(null);
    inputRef.current?.focus();
  };

  const openResumeContext = (resumeId: string | null | undefined) => {
    if (!resumeId || resumeId === 'default_user' || resumeId === 'demo_profile') {
      navigate('/resumes?demo=1');
      return;
    }
    navigate(`/resumes?resumeId=${encodeURIComponent(resumeId)}`);
  };

  const openSource = (source: ChatSource) => {
    openResumeContext(source.resume_id);
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

      <AssistantMessages messages={messages} isTyping={isTyping} scrollRef={scrollRef} onOpenSource={openSource} />

      <ArtifactPanel artifacts={artifacts} />

      <AttachmentChips
        attachments={attachments}
        userProfileId={userProfileId}
        onOpenResume={openResumeContext}
        onRemove={removeAttachment}
      />

      <ChatComposer
        input={input}
        inputRef={inputRef}
        isTyping={isTyping}
        jobDescription={jobDescription}
        shouldShowJobDescription={shouldShowJobDescription}
        onInputChange={handleInputChange}
        onInputKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void handleSendMessage();
          }
        }}
        onJobDescriptionChange={setJobDescription}
        onOpenContextMenu={setMenuAnchor}
        onOpenMentionSearch={openMentionSearch}
        onSend={() => void handleSendMessage()}
      />

      <AssistantContextMenu
        anchorEl={menuAnchor}
        options={contextOptions}
        onSelect={selectContextOption}
        onClose={() => setMenuAnchor(null)}
      />
      <MentionMenu
        anchorEl={mentionAnchor}
        query={mentionQuery}
        options={contextOptions}
        onSelect={selectMention}
        onClose={() => setMentionAnchor(null)}
      />
    </Drawer>
  );
};
