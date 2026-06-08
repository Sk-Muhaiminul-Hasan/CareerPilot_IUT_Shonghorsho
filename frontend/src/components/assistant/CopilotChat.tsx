import React, { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WorkIcon from '@mui/icons-material/Work';

import { sendChatMessage } from '@/services/chatService';
import { useArtifactStore } from '@/store/useArtifactStore';
import { useChatStore } from '@/store/useChatStore';
import type { ChatAttachment, ChatMessage, ChatSource } from '@/types/chat';

import { AssistantMessages } from './AssistantMessages';
import { AttachmentChips } from './AttachmentChips';
import { ArtifactPanel } from './ArtifactPanel';
import { ChatComposer } from './ChatComposer';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { MentionMenu } from './MentionMenu';
import { useCopilotChatController } from './useCopilotChatController';

const SIDEBAR_MIN = 280;
const SIDEBAR_MAX = 560;

export const CopilotChat: React.FC = () => {
  const {
    isOpen,
    activeJobId,
    userProfileId,
    sidebarWidth,
    messages,
    input,
    attachments,
    jobDescription,
    showJobDescription,
    isTyping,
    greetingLoaded,
    closeChat,
    setSidebarWidth,
    setMessages,
    setInput,
    setAttachments,
    setJobDescription,
    setShowJobDescription,
    setIsTyping,
    setGreetingLoaded,
  } = useChatStore();

  const navigate = useNavigate();
  const location = useLocation();
  const artifacts = useArtifactStore((s) => s.artifacts);
  const addArtifacts = useArtifactStore((s) => s.addArtifacts);

  // Refs that don't need to be persisted
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Context options (derived, not persisted)
  const [mentionAnchor, setMentionAnchor] = React.useState<HTMLElement | null>(null);
  const [mentionQuery, setMentionQuery] = React.useState('');

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

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Greeting on first open (no active job)
  useEffect(() => {
    if (!isOpen || activeJobId || greetingLoaded) return;
    setGreetingLoaded(true);
    void loadPersonalGreeting();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJobId, isOpen]);

  // Automated evaluation when opened with a job
  useEffect(() => {
    if (isOpen && activeJobId && !greetingLoaded) {
      setGreetingLoaded(true);
      void sendAutomatedEvaluation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJobId, isOpen]);

  // ── Drag-to-resize ──────────────────────────────────────────────────────────
  const handleDragStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      isDraggingRef.current = true;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      const startX = event.clientX;
      const startWidth = sidebarWidth;

      const onMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current) return;
        // Moving left increases width (sidebar anchored on right)
        const delta = startX - e.clientX;
        const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth + delta));
        setSidebarWidth(newWidth);
      };

      const onMouseUp = () => {
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [sidebarWidth, setSidebarWidth],
  );

  // ── Chat helpers ─────────────────────────────────────────────────────────────
  const addAttachment = (attachment: ChatAttachment) => {
    setAttachments((current) => {
      if (current.some((item) => item.type === attachment.type && item.label === attachment.label)) {
        return current;
      }
      return [...current, attachment];
    });
  };

  const selectContextOption = (option: ContextOption) => {
    if (option.action === 'job_description') {
      setShowJobDescription(true);
    }
    if (option.action === 'benchmark_prompt') {
      setInput(
        input.trim()
          ? `${input.trim()} Compare me against `
          : 'What skills am I missing compared with ',
      );
      inputRef.current?.focus();
    }
    if (option.attachment) {
      addAttachment(option.attachment);
    }
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
      setMentionQuery(mention[1] ?? '');
      setMentionAnchor(inputRef.current);
    } else {
      setMentionAnchor(null);
    }
  };

  const openMentionSearch = () => {
    setInput(
      !input || input.endsWith(' ') || input.endsWith('@') ? `${input}@` : `${input} @`,
    );
    setMentionQuery('');
    setMentionAnchor(inputRef.current);
    inputRef.current?.focus();
  };

  const selectMention = (option: ContextOption) => {
    selectContextOption(option);
    setInput(input.replace(/(?:^|\s)@[\w -]*$/, ` @${option.insertText} `).trimStart());
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

  if (!isOpen) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: sidebarWidth,
        zIndex: (theme) => theme.zIndex.drawer,
        display: 'flex',
        flexDirection: 'row',
        // Slide-in transition
        animation: 'copilot-slide-in 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        '@keyframes copilot-slide-in': {
          from: { transform: `translateX(${sidebarWidth}px)` },
          to: { transform: 'translateX(0)' },
        },
      }}
    >
      {/* ── Resize handle (left edge) ───────────────────────────────────────── */}
      <Box
        onMouseDown={handleDragStart}
        sx={{
          width: 6,
          flexShrink: 0,
          cursor: 'ew-resize',
          backgroundColor: 'transparent',
          transition: 'background-color 0.15s',
          '&:hover': {
            backgroundColor: 'rgba(0, 74, 198, 0.35)',
          },
          // Make the hit-area slightly wider without affecting layout
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: '0 -4px',
          },
        }}
        aria-label="Resize chat sidebar"
        role="separator"
        aria-orientation="vertical"
      />

      {/* ── Panel body ─────────────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f8f9ff',
          boxShadow: '-8px 0 28px rgba(11, 28, 48, 0.12)',
          borderLeft: '1px solid #c3c6d7',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            position: 'relative',
            px: 2.5,
            py: 2.25,
            background: 'linear-gradient(135deg, #004ac6 0%, #712ae2 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
              boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.25)',
            }}
          >
            <img
              src="/Auto_using_laptop-removebg-preview.png"
              alt="Career Copilot"
              style={{ width: 32, height: 32, objectFit: 'contain' }}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2, color: '#ffffff' }}>
              Career Copilot
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.85)' }}>
              Your AI career coach
            </Typography>
          </Box>
          {activeJobId && (
            <Chip
              icon={<WorkIcon sx={{ color: '#004ac6 !important' }} />}
              label="Job"
              size="small"
              sx={{
                backgroundColor: '#ffffff',
                color: '#004ac6',
                fontWeight: 600,
                '& .MuiChip-icon': { color: '#004ac6' },
              }}
            />
          )}
          <Tooltip title="Close">
            <IconButton
              onClick={closeChat}
              size="small"
              sx={{
                color: '#ffffff',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.24)' },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <AssistantMessages
          messages={messages}
          isTyping={isTyping}
          scrollRef={scrollRef}
          onOpenSource={openSource}
        />

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
          onOpenContextMenu={() => {}}
          onOpenMentionSearch={openMentionSearch}
          onSend={() => void handleSendMessage()}
          contextOptions={contextOptions}
          onSelectContextOption={selectContextOption}
        />
        <MentionMenu
          anchorEl={mentionAnchor}
          query={mentionQuery}
          options={contextOptions}
          onSelect={selectMention}
          onClose={() => setMentionAnchor(null)}
        />
      </Box>
    </Box>
  );
};
