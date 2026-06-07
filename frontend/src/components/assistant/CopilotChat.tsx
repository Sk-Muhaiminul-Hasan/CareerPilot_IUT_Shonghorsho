import React from 'react';
import { Drawer } from '@mui/material';

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

  return (
    <Drawer
      anchor="right"
      open={chat.isOpen}
      variant="persistent"
      PaperProps={{
        sx: {
          width: 420,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f8f9ff',
          boxShadow: '-8px 0 28px rgba(11, 28, 48, 0.12)',
          borderLeft: '1px solid #c3c6d7',
        },
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
    </Drawer>
  );
};
