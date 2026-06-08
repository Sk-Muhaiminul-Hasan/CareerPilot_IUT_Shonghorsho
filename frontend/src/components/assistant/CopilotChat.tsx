import React, { useCallback, useRef } from 'react';
import { Box, Drawer } from '@mui/material';

import { useChatStore } from '@/store/useChatStore';

import { AssistantDrawerHeader } from './AssistantDrawerHeader';
import { AssistantMessages } from './AssistantMessages';
import { AttachmentChips } from './AttachmentChips';
import { ChatComposer } from './ChatComposer';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { useCopilotChatController } from './useCopilotChatController';
import { ArtifactWorkspace } from './ArtifactWorkspace';

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

  const showWorkspace = Boolean(chat.activeArtifact);
  const drawerWidth = showWorkspace ? Math.max(880, sidebarWidth + 520) : sidebarWidth;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: drawerWidth,
        zIndex: (theme) => theme.zIndex.drawer,
        display: 'flex',
        flexDirection: 'row',
        // Slide-in transition
        animation: 'copilot-slide-in 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        '@keyframes copilot-slide-in': {
          from: { transform: `translateX(${drawerWidth}px)` },
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
      />
      <Drawer
        anchor="right"
        open={chat.isOpen}
        variant="persistent"
        PaperProps={{
          sx: {
            width: drawerWidth,
            display: 'flex',
            flexDirection: 'row',
            backgroundColor: '#f8f9ff',
            boxShadow: '-8px 0 28px rgba(11, 28, 48, 0.12)',
            borderLeft: '1px solid #c3c6d7',
            transition: 'width 0.2s cubic-bezier(0, 0, 0.2, 1)',
          },
        }}
      >
        {/* Left Pane: Artifact Workspace (Visible only when an artifact is open) */}
        {showWorkspace && chat.activeArtifact && (
          <Box
            sx={{
              flex: 1,
              height: '100%',
              borderRight: '1px solid #c3c6d7',
              display: { xs: 'block', md: 'block' },
              width: { xs: '100%', md: 'calc(100% - 420px)' },
            }}
          >
            <ArtifactWorkspace
              artifact={chat.activeArtifact}
              regeneratingArtifactId={chat.regeneratingArtifactId}
              onUpdateArtifact={chat.updateArtifact}
              onRemoveArtifact={chat.removeArtifact}
              onRegenerateArtifact={(artifact) => void chat.regenerateArtifact(artifact)}
              onClose={() => chat.setActiveArtifactId(null)}
            />
          </Box>
        )}

        {/* Right Pane: Chat Interface */}
        <Box
          sx={{
            width: 420,
            minWidth: 420,
            height: '100%',
            display: { xs: showWorkspace ? 'none' : 'flex', md: 'flex' },
            flexDirection: 'column',
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
            regeneratingArtifactId={chat.regeneratingArtifactId}
            onOpenArtifact={(id) => chat.setActiveArtifactId(id)}
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
            onCloseJobDescription={chat.onCloseJobDescription}
          />
        </Box>
      </Drawer>
    </Box>
  );
};
