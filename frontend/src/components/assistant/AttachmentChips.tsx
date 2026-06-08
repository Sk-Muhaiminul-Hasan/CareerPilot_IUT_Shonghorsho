import React from 'react';
import { Box, Chip } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import type { ChatAttachment } from '@/types/chat';

interface AttachmentChipsProps {
  attachments: ChatAttachment[];
  userProfileId: string | null;
  onOpenResume: (resumeId: string | null | undefined) => void;
  onRemove: (index: number) => void;
}

export const AttachmentChips: React.FC<AttachmentChipsProps> = ({
  attachments,
  userProfileId,
  onOpenResume,
  onRemove,
}) => {
  if (attachments.length === 0 && !userProfileId) return null;

  return (
    <Box sx={{ px: 2, py: 1, display: 'flex', flexWrap: 'wrap', gap: 1, borderTop: '1px solid #e0e0e0', flexShrink: 0 }}>
      {attachments.map((attachment, index) => (
        <Chip
          key={`${attachment.type}-${attachment.label}`}
          label={attachment.label}
          size="small"
          onClick={
            attachment.type === 'resume' || attachment.type === 'rag_placeholder'
              ? () => onOpenResume(attachment.value)
              : undefined
          }
          onDelete={() => onRemove(index)}
        />
      ))}
    </Box>
  );
};
