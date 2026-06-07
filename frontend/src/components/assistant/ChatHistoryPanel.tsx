import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import type { ChatSession } from '@/types/chat';

interface ChatHistoryPanelProps {
  open: boolean;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

export function ChatHistoryPanel({
  open,
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
}: ChatHistoryPanelProps) {
  return (
    <Collapse in={open}>
      <Box sx={{ borderBottom: '1px solid #d8dced', bgcolor: '#ffffff', px: 1.5, py: 1.25 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, px: 0.5 }}>
          Previous chats
        </Typography>
        <Stack spacing={0.75} sx={{ mt: 1, maxHeight: 190, overflowY: 'auto' }}>
          {sessions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 0.5, py: 1 }}>
              No previous chats yet.
            </Typography>
          ) : (
            sessions.map((session) => {
              const selected = session.id === activeSessionId;
              return (
                <Box
                  key={session.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(session.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect(session.id);
                    }
                  }}
                  sx={{
                    width: '100%',
                    border: '1px solid',
                    borderColor: selected ? '#004ac6' : '#e4e7f2',
                    borderRadius: 1,
                    backgroundColor: selected ? 'rgba(0, 74, 198, 0.07)' : '#ffffff',
                    color: 'inherit',
                    p: 1,
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    '&:hover': { borderColor: '#004ac6', backgroundColor: 'rgba(0, 74, 198, 0.05)' },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 800 }}>
                      {session.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {new Date(session.updatedAt).toLocaleString()} - {session.messages.length} messages
                    </Typography>
                  </Box>
                  <Tooltip title="Delete chat">
                    <IconButton
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(session.id);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })
          )}
        </Stack>
      </Box>
    </Collapse>
  );
}
