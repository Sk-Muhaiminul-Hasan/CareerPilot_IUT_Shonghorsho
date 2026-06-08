import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { sendChatMessage } from '@/services/chatService';
import { useArtifactStore, type StoredArtifact } from '@/store/useArtifactStore';
import { useChatHistoryStore, createChatMessage } from '@/store/useChatHistoryStore';
import { useChatStore } from '@/store/useChatStore';
import type { ChatAttachment, ChatMessage, ChatSource, ChatUiMessage } from '@/types/chat';
import { artifactContextOptions, artifactToAttachment } from './artifactContextOptions';
import { buildContextOptions, type ContextOption } from './contextOptions';

export function useCopilotChatController() {
  const { isOpen, activeJobId, userProfileId, closeChat } = useChatStore();
  const navigate = useNavigate();
  const location = useLocation();
  const artifacts = useArtifactStore((s) => s.artifacts);
  const addArtifacts = useArtifactStore((s) => s.addArtifacts);
  const updateArtifact = useArtifactStore((s) => s.updateArtifact);
  const removeArtifact = useArtifactStore((s) => s.removeArtifact);
  const activeArtifactId = useArtifactStore((s) => s.activeArtifactId);
  const setActiveArtifactId = useArtifactStore((s) => s.setActiveArtifactId);
  const sessions = useChatHistoryStore((s) => s.sessions);
  const activeSessionId = useChatHistoryStore((s) => s.activeSessionId);
  const createSession = useChatHistoryStore((s) => s.createSession);
  const setActiveSession = useChatHistoryStore((s) => s.setActiveSession);
  const appendMessage = useChatHistoryStore((s) => s.appendMessage);
  const replaceMessages = useChatHistoryStore((s) => s.replaceMessages);
  const deleteSession = useChatHistoryStore((s) => s.deleteSession);

  const [input, setInput] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [showJobDescription, setShowJobDescription] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [regeneratingArtifactId, setRegeneratingArtifactId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState<HTMLElement | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const greetedSessionRef = useRef<string | null>(null);
  const evaluatedSessionRef = useRef<string | null>(null);
  const lastOpenedJobRef = useRef<string | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );
  const messages = activeSession?.messages ?? [];
  const activeArtifact = useMemo(() => {
    return artifacts.find((a) => a.id === activeArtifactId) ?? null;
  }, [activeArtifactId, artifacts]);
  const attachedResumeId =
    attachments.find((attachment) => attachment.type === 'resume')?.value || userProfileId;
  const contextOptions: ContextOption[] = useMemo(() => {
    return buildContextOptions({ activeJobId, userProfileId, screenPath: location.pathname }).concat(
      artifactContextOptions(artifacts),
    );
  }, [activeJobId, artifacts, location.pathname, userProfileId]);
  const shouldShowJobDescription = showJobDescription || Boolean(jobDescription.trim()) ||
    (!activeJobId && /\b(ready|cover letter|posting|job description|role)\b/i.test(input));

  const historyFromMessages = (items: ChatUiMessage[]): ChatMessage[] =>
    items.slice(-6).map((message) => ({ role: message.sender, content: message.text }));

  const ensureSession = useCallback(() => {
    if (activeSession) return activeSession.id;
    return createSession({ activeJobId: activeJobId ?? null, userProfileId });
  }, [activeJobId, activeSession, createSession, userProfileId]);

  const appendAssistantMessage = useCallback(
    (sessionId: string, text: string, sources?: ChatSource[]) => {
      appendMessage(sessionId, createChatMessage('assistant', text, sources));
    },
    [appendMessage],
  );

  const loadPersonalGreeting = useCallback(
    async (sessionId: string) => {
      setIsTyping(true);
      try {
        const response = await sendChatMessage({
          query:
            'Give me a short friendly opening using my CV context. One sentence only, then three tiny suggested prompts.',
          user_profile_id: attachedResumeId,
          session_id: sessionId,
          attachments: contextOptions
            .filter((option) => option.id === 'current-screen' || option.id === 'active-cv')
            .map((option) => option.attachment)
            .filter((attachment): attachment is ChatAttachment => Boolean(attachment)),
        });
        replaceMessages(sessionId, [createChatMessage('assistant', response.answer, response.sources)]);
        addArtifacts(response.artifacts);
      } catch {
        replaceMessages(sessionId, [
          createChatMessage(
            'assistant',
            'Hey, I can use your latest CV automatically. Ask me about fit, gaps, roadmaps, or letters.',
          ),
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [addArtifacts, attachedResumeId, contextOptions, replaceMessages],
  );

  const sendAutomatedEvaluation = useCallback(
    async (sessionId: string) => {
      setIsTyping(true);
      replaceMessages(sessionId, [
        createChatMessage('assistant', 'Analyzing your background against this saved job context...'),
      ]);
      try {
        const response = await sendChatMessage({
          query: 'Please review my fitness for this role. What are my gaps and match score?',
          active_job_id: activeJobId,
          user_profile_id: attachedResumeId,
          session_id: sessionId,
          attachments,
        });
        appendAssistantMessage(sessionId, response.answer, response.sources);
        addArtifacts(response.artifacts);
      } catch {
        appendAssistantMessage(sessionId, 'Sorry, I could not reach the assistant API.');
      } finally {
        setIsTyping(false);
      }
    },
    [activeJobId, addArtifacts, appendAssistantMessage, attachedResumeId, attachments, replaceMessages],
  );

  useEffect(() => {
    if (!isOpen) return;
    if (!activeJobId) {
      lastOpenedJobRef.current = null;
      if (!activeSession) createSession({ userProfileId });
      return;
    }
    if (lastOpenedJobRef.current !== activeJobId || !activeSession) {
      lastOpenedJobRef.current = activeJobId;
      const existing = sessions.find((session) => session.context.activeJobId === activeJobId);
      if (existing) setActiveSession(existing.id);
      else createSession({ title: 'Job fit review', activeJobId, userProfileId });
    }
  }, [activeJobId, activeSession, createSession, isOpen, sessions, setActiveSession, userProfileId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!isOpen || activeJobId || !activeSession || activeSession.messages.length > 0) return;
    if (greetedSessionRef.current === activeSession.id) return;
    greetedSessionRef.current = activeSession.id;
    void loadPersonalGreeting(activeSession.id);
  }, [activeJobId, activeSession, isOpen, loadPersonalGreeting]);

  useEffect(() => {
    const isJobSession = activeSession?.context.activeJobId === activeJobId;
    if (!isOpen || !activeJobId || !activeSession || !isJobSession || activeSession.messages.length > 0) {
      return;
    }
    if (evaluatedSessionRef.current === activeSession.id) return;
    evaluatedSessionRef.current = activeSession.id;
    void sendAutomatedEvaluation(activeSession.id);
  }, [activeJobId, activeSession, isOpen, sendAutomatedEvaluation]);

  const addAttachment = (attachment: ChatAttachment) => {
    setAttachments((current) => {
      if (current.some((item) => item.type === attachment.type && item.label === attachment.label)) return current;
      return [...current, attachment];
    });
    setMenuAnchor(null);
  };

  const selectContextOption = (option: ContextOption) => {
    if (option.action === 'job_description') setShowJobDescription(true);
    if (option.action === 'benchmark_prompt') {
      setInput((current) =>
        current.trim() ? `${current.trim()} Compare me against ` : 'What skills am I missing compared with ',
      );
      inputRef.current?.focus();
    }
    if (option.attachment) addAttachment(option.attachment);
    setMenuAnchor(null);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;
    const sessionId = ensureSession();
    const userMsg = input.trim();
    const history = historyFromMessages(messages);
    setInput('');
    appendMessage(sessionId, createChatMessage('user', userMsg));
    setIsTyping(true);
    try {
      const response = await sendChatMessage({
        query: userMsg,
        active_job_id: activeJobId,
        user_profile_id: attachedResumeId,
        session_id: sessionId,
        job_description: jobDescription.trim() || undefined,
        attachments,
        conversation_history: history,
      });
      appendAssistantMessage(sessionId, response.answer, response.sources);
      addArtifacts(response.artifacts);
    } catch {
      appendAssistantMessage(sessionId, 'Sorry, I could not reach the assistant API.');
    } finally {
      setIsTyping(false);
    }
  };

  const regenerateArtifact = async (artifact: StoredArtifact) => {
    const sessionId = ensureSession();
    const history = historyFromMessages(messages);
    const prompt = [
      `Regenerate the artifact "${artifact.title}".`,
      `Return the improved ${artifact.format} as a clean artifact, not just conversational text.`,
      'Preserve the useful intent, improve structure, and keep it downloadable/editable.',
    ].join(' ');
    appendMessage(sessionId, createChatMessage('user', `Regenerate artifact: ${artifact.title}`));
    setRegeneratingArtifactId(artifact.id);
    setIsTyping(true);
    try {
      const response = await sendChatMessage({
        query: prompt,
        active_job_id: activeJobId,
        user_profile_id: attachedResumeId,
        session_id: sessionId,
        job_description: jobDescription.trim() || undefined,
        attachments: [...attachments, artifactToAttachment(artifact)],
        conversation_history: history,
      });
      appendAssistantMessage(sessionId, response.answer, response.sources);
      addArtifacts(response.artifacts);
    } catch {
      appendAssistantMessage(sessionId, 'Sorry, I could not regenerate that artifact yet.');
    } finally {
      setRegeneratingArtifactId(null);
      setIsTyping(false);
    }
  };

  const startNewChat = () => {
    createSession({ activeJobId: activeJobId ?? null, userProfileId });
    setAttachments([]);
    setInput('');
    setJobDescription('');
    setShowJobDescription(false);
    setHistoryOpen(false);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    const mention = value.match(/(?:^|\s)@([\w -]*)$/);
    setInput(value);
    setMentionQuery(mention?.[1] ?? '');
    setMentionAnchor(mention ? inputRef.current : null);
  };

  const openMentionSearch = () => {
    setInput((current) => (!current || current.endsWith(' ') || current.endsWith('@') ? `${current}@` : `${current} @`));
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

  const onCloseJobDescription = () => {
    setJobDescription('');
    setShowJobDescription(false);
  };

  const openResumeContext = (resumeId: string | null | undefined) => {
    if (!resumeId || resumeId === 'default_user' || resumeId === 'demo_profile') {
      navigate('/resumes?demo=1');
      return;
    }
    navigate(`/resumes?resumeId=${encodeURIComponent(resumeId)}`);
  };

  return {
    activeArtifact, activeArtifactId, setActiveArtifactId,
    activeJobId, activeSessionId, artifacts, attachments, closeChat, contextOptions, deleteSession,
    handleInputChange, handleSendMessage, historyOpen, input, inputRef, isOpen, isTyping, jobDescription,
    mentionAnchor, mentionQuery, messages, menuAnchor, openMentionSearch, openResumeContext,
    openSource: (source: ChatSource) => openResumeContext(source.resume_id),
    regenerateArtifact, regeneratingArtifactId, removeArtifact,
    removeAttachment: (index: number) => setAttachments((current) => current.filter((_, i) => i !== index)),
    scrollRef, selectContextOption, selectMention,
    selectSession: (sessionId: string) => {
      setActiveSession(sessionId);
      setHistoryOpen(false);
    },
    sessions, setHistoryOpen, setJobDescription, setMenuAnchor,
    closeMentionMenu: () => setMentionAnchor(null),
    shouldShowJobDescription, startNewChat, updateArtifact, userProfileId,
    onCloseJobDescription,
  };
}
