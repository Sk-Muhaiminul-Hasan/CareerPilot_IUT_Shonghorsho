/**
 * Kanban Application Tracker for the Dashboard "Tracker" tab.
 * Columns: Applied | Interviewing | Offer | Rejected
 * Cards show job info from ApplicationResponse schema.
 *
 * Data comes from useApplications() hook — real backend data.
 */
import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BusinessIcon from '@mui/icons-material/Business';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SendIcon from '@mui/icons-material/Send';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

import { useApplications } from '@/hooks/useApplications';
import type { Application } from '@/types/application';

/** Map application statuses to Kanban columns. */
const COLUMN_STATUS_MAP: Record<string, string[]> = {
  Applied: ['applied', 'applying'],
  Interviewing: ['interview'],
  Offer: ['offer'],
  Rejected: ['rejected', 'withdrawn', 'failed'],
};

const COLUMN_CONFIG = [
  { label: 'Applied', color: '#004ac6', lightColor: '#dbe1ff', borderColor: '#004ac6' },
  { label: 'Interviewing', color: '#712ae2', lightColor: '#eaddff', borderColor: '#712ae2' },
  { label: 'Offer', color: '#1a7f4b', lightColor: '#dcfce7', borderColor: '#1a7f4b' },
  { label: 'Rejected', color: '#737686', lightColor: '#f1f5f9', borderColor: '#c3c6d7' },
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function ApplicationCard({ app }: { app: Application }) {
  const when = app.applied_at ?? app.updated_at;
  return (
    <Card
      sx={{
        mb: 1.5,
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(11,28,48,0.04)',
        transition: 'box-shadow 0.15s, transform 0.15s',
        cursor: 'grab',
        '&:hover': {
          boxShadow: '0 6px 20px rgba(11,28,48,0.1)',
          transform: 'translateY(-1px)',
        },
      }}
    >
      <CardContent sx={{ p: '14px !important' }}>
        {/* Top row: time ago + menu */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
            {timeAgo(when)}
          </Typography>
          <IconButton size="small" sx={{ p: 0.25 }}>
            <MoreHorizIcon sx={{ fontSize: 16, color: '#737686' }} />
          </IconButton>
        </Box>

        {/* Company icon + job info */}
        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', mb: 1.25 }}>
          <Box
            sx={{
              width: 36, height: 36, borderRadius: 2,
              bgcolor: '#e5eeff', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <BusinessIcon sx={{ fontSize: 18, color: '#004ac6' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap color="text.primary">
              {app.job_title ?? `Job #${app.job_id.slice(0, 8)}`}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              Mode: {app.apply_mode}
            </Typography>
          </Box>
        </Box>

        {/* Footer row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {app.ats_score != null && (
            <Chip
              label={`ATS ${Math.round(app.ats_score * 100)}%`}
              size="small"
              sx={{ bgcolor: '#e5eeff', color: '#004ac6', fontWeight: 700, fontSize: '0.65rem', height: 20 }}
            />
          )}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {app.notes ?? 'Sent'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

function KanbanColumn({
  config,
  apps,
  loading,
}: {
  config: typeof COLUMN_CONFIG[number];
  apps: Application[];
  loading: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const showLimit = 4;
  const hasMore = apps.length > showLimit;
  const displayedApps = isExpanded ? apps : apps.slice(0, showLimit);

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 240,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Column header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 2,
          pb: 1.5,
          borderBottom: `2px solid ${config.color}`,
        }}
      >
        <Typography variant="subtitle1" fontWeight={700} color="text.primary">
          {config.label}
        </Typography>
        <Chip
          label={loading ? '…' : apps.length}
          size="small"
          sx={{
            bgcolor: config.lightColor,
            color: config.color,
            fontWeight: 700,
            height: 22,
            fontSize: '0.75rem',
          }}
        />
        <IconButton size="small" sx={{ ml: 'auto', p: 0.25 }}>
          <MoreHorizIcon sx={{ fontSize: 16, color: '#737686' }} />
        </IconButton>
      </Box>

      {/* Cards */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} sx={{ mb: 1.5, borderRadius: 3 }}>
              <CardContent>
                <Skeleton variant="rounded" width={36} height={36} sx={{ borderRadius: 2, mb: 1 }} />
                <Skeleton variant="text" width="75%" />
                <Skeleton variant="text" width="50%" />
              </CardContent>
            </Card>
          ))
        ) : apps.length === 0 ? (
          <Box
            sx={{
              border: '1.5px dashed #c3c6d7',
              borderRadius: 3,
              p: 2.5,
              textAlign: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              No applications here yet.
            </Typography>
          </Box>
        ) : (
          <>
            {displayedApps.map((app) => (
              <ApplicationCard key={app.id} app={app} />
            ))}
            {hasMore && (
              <Button
                onClick={() => setIsExpanded(!isExpanded)}
                variant="text"
                size="small"
                fullWidth
                sx={{
                  mt: 1,
                  mb: 1.5,
                  color: '#004ac6',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: 2.5,
                  bgcolor: '#e5eeff',
                  py: 0.75,
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: '#004ac6',
                    color: '#ffffff',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(0,74,198,0.15)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                  },
                }}
              >
                {isExpanded ? 'Show Less' : `View More (${apps.length - showLimit} more)`}
              </Button>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

/** Top stat cards matching the application tracker design. */
function TrackerStats({ apps }: { apps: Application[] }) {
  const applied = apps.filter((a) => ['applied', 'applying'].includes(a.status.toLowerCase())).length;
  const interviews = apps.filter((a) => ['interview'].includes(a.status.toLowerCase())).length;
  const offers = apps.filter((a) => ['offer'].includes(a.status.toLowerCase())).length;
  const responseRate = apps.length > 0 ? Math.round(((applied + interviews) / apps.length) * 100) : 0;

  const cardStyle = {
    borderRadius: 3,
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 8px rgba(0,74,198,0.04)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 6px 20px rgba(0,74,198,0.08)',
    },
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
      {/* Applied */}
      <Card sx={cardStyle}>
        <CardContent sx={{ p: '16px !important', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#e5eeff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SendIcon sx={{ fontSize: 18, color: '#004ac6' }} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>Applied</Typography>
            <Typography variant="h6" fontWeight={800} color="text.primary">{applied}</Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Interviewing */}
      <Card sx={cardStyle}>
        <CardContent sx={{ p: '16px !important', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#e5eeff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AccessTimeIcon sx={{ fontSize: 18, color: '#004ac6' }} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>Interviewing</Typography>
            <Typography variant="h6" fontWeight={800} color="text.primary">{interviews}</Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Offers Received */}
      <Card sx={cardStyle}>
        <CardContent sx={{ p: '16px !important', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#e5eeff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EmojiEventsIcon sx={{ fontSize: 18, color: '#004ac6' }} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>Offers Received</Typography>
            <Typography variant="h6" fontWeight={800} color="text.primary">{offers}</Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Response Rate (Gradient) */}
      <Card
        sx={{
          borderRadius: 3,
          background: 'linear-gradient(135deg, #004ac6 0%, #002d80 100%)',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,74,198,0.15)',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 24px rgba(0,74,198,0.25)',
          },
        }}
      >
        <CardContent sx={{ p: '16px !important', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUpIcon sx={{ fontSize: 18, color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Response Rate</Typography>
            <Typography variant="h6" fontWeight={800} color="#fff">{responseRate}%</Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default function TrackerView() {
  const { data: page1, isLoading } = useApplications(1, 100);
  const allApps = page1?.items ?? [];

  // Distribute apps into columns
  const columnApps = COLUMN_CONFIG.map((col) => {
    const statuses = COLUMN_STATUS_MAP[col.label] ?? [];
    return {
      config: col,
      apps: allApps.filter((a) => statuses.includes(a.status.toLowerCase())),
    };
  });

  return (
    <Box>
      {/* Top stats */}
      <TrackerStats apps={allApps} />

      {/* Kanban board */}
      <Box
        sx={{
          display: 'flex',
          gap: 2.5,
          overflowX: 'auto',
          pb: 1,
          alignItems: 'flex-start',
          minHeight: 400,
          mt: 3,
        }}
      >
        {columnApps.map(({ config, apps }) => (
          <KanbanColumn key={config.label} config={config} apps={apps} loading={isLoading} />
        ))}
      </Box>
    </Box>
  );
}
