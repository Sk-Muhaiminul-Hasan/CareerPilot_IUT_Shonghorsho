import React from 'react';
import { Menu, MenuItem } from '@mui/material';
import type { ChatAttachment } from '@/types/chat';

interface AssistantContextMenuProps {
  anchorEl: HTMLElement | null;
  activeJobId: string | null;
  userProfileId: string | null;
  onAddAttachment: (attachment: ChatAttachment) => void;
  onClose: () => void;
  onShowJobDescription: () => void;
}

export const AssistantContextMenu: React.FC<AssistantContextMenuProps> = ({
  anchorEl,
  activeJobId,
  userProfileId,
  onAddAttachment,
  onClose,
  onShowJobDescription,
}) => (
  <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
    <MenuItem
      onClick={() =>
        onAddAttachment({
          type: 'resume',
          label: userProfileId === 'default_user' ? 'Demo CV' : 'Active CV',
          value: userProfileId || 'demo_profile',
        })
      }
    >
      Attach CV context
    </MenuItem>
    <MenuItem
      disabled={!activeJobId}
      onClick={() =>
        onAddAttachment({
          type: 'job',
          label: 'Current job',
          value: activeJobId || '',
        })
      }
    >
      Attach current job
    </MenuItem>
    <MenuItem onClick={onShowJobDescription}>Paste job description</MenuItem>
    <MenuItem
      onClick={() =>
        onAddAttachment({
          type: 'benchmark',
          label: 'Google internship',
          value: 'Google internship benchmark: algorithms, data structures, projects, teamwork, programming fundamentals.',
        })
      }
    >
      Attach Google benchmark
    </MenuItem>
    <MenuItem
      onClick={() =>
        onAddAttachment({
          type: 'rag_placeholder',
          label: 'Pillar 2 demo RAG',
          value: 'Use section-chunked demo CV context until the Profile and Resume Intelligence pillar is complete.',
        })
      }
    >
      Use Pillar 2 demo RAG
    </MenuItem>
  </Menu>
);
