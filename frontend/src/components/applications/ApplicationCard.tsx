import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CancelIcon from '@mui/icons-material/Cancel';
import SendIcon from '@mui/icons-material/Send';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

import type { Application } from '@/types/application';

const APPLY_MODE_LABELS: Record<string, string> = {
  review: 'Reviewed before applying',
  autonomous: 'Auto Applied (Beta)',
  manual: 'Applied Manually',
};

const STATUS_CONFIG: Record<
  string,
  { color: 'default' | 'warning' | 'info' | 'success' | 'error'; icon: React.ReactElement }
> = {
  queued: { color: 'default', icon: <HourglassEmptyIcon fontSize="small" /> },
  pending_review: { color: 'warning', icon: <HourglassEmptyIcon fontSize="small" /> },
  approved: { color: 'info', icon: <CheckCircleIcon fontSize="small" /> },
  applying: { color: 'info', icon: <HourglassEmptyIcon fontSize="small" /> },
  applied: { color: 'success', icon: <SendIcon fontSize="small" /> },
  interview: { color: 'success', icon: <EmojiEventsIcon fontSize="small" /> },
  rejected: { color: 'error', icon: <CancelIcon fontSize="small" /> },
  offer: { color: 'success', icon: <EmojiEventsIcon fontSize="small" /> },
  failed: { color: 'error', icon: <CancelIcon fontSize="small" /> },
};

const USER_VISIBLE_STATUSES = ['applied', 'interview', 'offer', 'rejected'] as const;

interface ApplicationCardProps {
  application: Application;
  onApprove?: (appId: string) => void;
  onUpdateStatus?: (appId: string, status: string) => void;
  onClick?: (appId: string) => void;
}

function formatCardDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ApplicationCard({
  application,
  onApprove,
  onUpdateStatus,
  onClick,
}: ApplicationCardProps) {
  const statusConf = STATUS_CONFIG[application.status] ?? {
    color: 'default' as const,
    icon: <HourglassEmptyIcon fontSize="small" />,
  };

  const displayTitle = application.job_title || application.job_id.slice(0, 8);
  const displayLabel = application.job_company
    ? `${displayTitle} @ ${application.job_company}`
    : displayTitle;
  const cardDate = formatCardDate(application.created_at);

  const handleCardClick = () => {
    if (onClick) onClick(application.id);
  };

  const handleStatusChange = (event: { target: { value: unknown } }) => {
    const newStatus = event.target.value as string;
    if (onUpdateStatus) onUpdateStatus(application.id, newStatus);
  };

  return (
    <Card sx={onClick ? { cursor: 'pointer' } : undefined} onClick={handleCardClick}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap>
              {displayLabel}
            </Typography>
            <Box sx={{ mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Job ID: {application.job_id.slice(0, 8)}...
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Mode: {APPLY_MODE_LABELS[application.apply_mode] ?? application.apply_mode}
              </Typography>
              <Chip
                label={APPLY_MODE_LABELS[application.apply_mode] ?? application.apply_mode}
                size="small"
                sx={{ alignSelf: 'flex-start', bgcolor: 'action.hover' }}
              />
            </Box>
          </Box>

          <Chip
            icon={statusConf.icon}
            label={application.status.charAt(0).toUpperCase() + application.status.slice(1)}
            color={statusConf.color}
            size="small"
          />
        </Box>

        {application.ats_score != null && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              ATS Score: {Math.round(application.ats_score * 100)}%
            </Typography>
          </Box>
        )}

        {application.notes && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {application.notes}
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          Created: {formatCardDate(application.created_at)}
          {application.applied_at && ` | Applied: ${formatCardDate(application.applied_at)}`}
        </Typography>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        {application.status === 'pending_review' && onApprove && (
          <Button size="small" variant="contained" onClick={(e) => { e.stopPropagation(); onApprove(application.id); }}>
            Approve
          </Button>
        )}
        {onUpdateStatus && (
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id={`status-select-${application.id}`} shrink>Status</InputLabel>
            <Select
              labelId={`status-select-${application.id}`}
              label="Status"
              value={application.status}
              onChange={handleStatusChange}
              onClick={(e) => e.stopPropagation()}
            >
              {USER_VISIBLE_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </CardActions>
    </Card>
  );
}

export default ApplicationCard;
