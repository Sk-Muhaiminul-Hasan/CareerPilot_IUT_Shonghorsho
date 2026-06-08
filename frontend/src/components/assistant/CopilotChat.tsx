import React, { useCallback, useRef } from 'react';
import { Box } from '@mui/material';

import { useChatStore } from '@/store/useChatStore';

import { AssistantContextMenu } from './AssistantContextMenu';
import { AssistantDrawerHeader } from './AssistantDrawerHeader';
import { AssistantMessages } from './AssistantMessages';
import { AttachmentChips } from './AttachmentChips';
import { ArtifactPanel } from './ArtifactPanel';
import { ChatComposer } from './ChatComposer';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { MentionMenu } from './MentionMenu';
import { useCopilotChatController } from './useCopilotChatController';

export const CopilotChat: React.FC = () => {
  const chat = useCopilotChatController();
  const sidebarWidth = useChatStore((s) => s.sidebarWidth);
  const setSidebarWidth = useChatStore((s) => s.setSidebarWidth);
  const isDraggingRef = useRef(false);

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
        setSidebarWidth(startWidth + delta);
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

  if (!chat.isOpen) return null;

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
        <AssistantDrawerHeader
          activeJobId={chat.activeJobId}
          historyOpen={chat.historyOpen}
          onClose={chat.closeChat}
          onNewChat={chat.startNewChat}
          onToggleHistory={() => chat.setHistoryOpen((current) => !current)}
        />
        <ChatHistoryPanel
          open={chat.historyOpen}
          sessions={chat.sessions}
          activeSessionId={chat.activeSessionId}
          onSelect={chat.selectSession}
          onDelete={chat.deleteSession}
        />
        <AssistantMessages
          messages={chat.messages}
          isTyping={chat.isTyping}
          scrollRef={chat.scrollRef}
          onOpenSource={chat.openSource}
        />
        <ArtifactPanel
          artifacts={chat.artifacts}
          regeneratingArtifactId={chat.regeneratingArtifactId}
          onUpdateArtifact={chat.updateArtifact}
          onRemoveArtifact={chat.removeArtifact}
          onRegenerateArtifact={(artifact) => void chat.regenerateArtifact(artifact)}
        />
        <AttachmentChips
          attachments={chat.attachments}
          userProfileId={chat.userProfileId}
          onOpenResume={chat.openResumeContext}
          onRemove={chat.removeAttachment}
        />
        <ChatComposer
          input={chat.input}
          inputRef={chat.inputRef}
          isTyping={chat.isTyping}
          jobDescription={chat.jobDescription}
          shouldShowJobDescription={chat.shouldShowJobDescription}
          onInputChange={chat.handleInputChange}
          onInputKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void chat.handleSendMessage();
            }
          }}
          onJobDescriptionChange={chat.setJobDescription}
          onOpenContextMenu={chat.setMenuAnchor}
          onOpenMentionSearch={chat.openMentionSearch}
          onSend={() => void chat.handleSendMessage()}
          contextOptions={chat.contextOptions}
          onSelectContextOption={chat.selectContextOption}
        />
        <AssistantContextMenu
          anchorEl={chat.menuAnchor}
          options={chat.contextOptions}
          onSelect={chat.selectContextOption}
          onClose={() => chat.setMenuAnchor(null)}
        />
        <MentionMenu
          anchorEl={chat.mentionAnchor}
          query={chat.mentionQuery}
          options={chat.contextOptions}
          onSelect={chat.selectMention}
          onClose={chat.closeMentionMenu}
        />
      </Box>
    </Box>
  );
};
