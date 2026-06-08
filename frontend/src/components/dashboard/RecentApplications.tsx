import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import BusinessIcon from '@mui/icons-material/Business';

import type { ApplicationListResponse } from '@/types/application';

interface RecentApplicationsProps {
  data: ApplicationListResponse | undefined;
  loading?: boolean;
}

/** Map status strings to chip colors. */
const STATUS_CHIP_STYLES: Record<string, { color: string; bgcolor: string }> = {
  applied: { color: '#004ac6', bgcolor: '#dbe1ff' },
  interview: { color: '#712ae2', bgcolor: '#eaddff' },
  offer: { color: '#1a7f4b', bgcolor: '#dcfce7' },
  rejected: { color: '#737686', bgcolor: '#f1f5f9' },
  pending_review: { color: '#943700', bgcolor: '#ffdbcd' },
  approved: { color: '#004ac6', bgcolor: '#e5eeff' },
  queued: { color: '#737686', bgcolor: '#f1f5f9' },
  applying: { color: '#004ac6', bgcolor: '#e5eeff' },
  withdrawn: { color: '#737686', bgcolor: '#f1f5f9' },
  failed: { color: '#ba1a1a', bgcolor: '#ffdad6' },
};

function getStatusStyle(status: string) {
  return STATUS_CHIP_STYLES[status.toLowerCase()] ?? { color: '#434655', bgcolor: '#e5eeff' };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function RecentApplications({ data, loading = false }: RecentApplicationsProps) {
  const items = data?.items ?? [];

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: '24px !important', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight={700} color="text.primary">
            Recent Applications
          </Typography>
          <OpenInNewIcon sx={{ fontSize: 18, color: 'text.secondary', cursor: 'pointer', '&:hover': { color: '#004ac6' } }} />
        </Box>

        {/* List */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Skeleton variant="rounded" width={40} height={40} sx={{ borderRadius: 2, flexShrink: 0 }} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="70%" />
                  <Skeleton variant="text" width="50%" />
                </Box>
                <Skeleton variant="rounded" width={64} height={22} sx={{ borderRadius: 9999 }} />
              </Box>
            ))
          ) : items.length === 0 ? (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="body2" color="text.secondary" align="center">
                No applications yet.
                <br />
                Start by searching for jobs.
              </Typography>
            </Box>
          ) : (
            items.map((app) => {
              const style = getStatusStyle(app.status);
              const when = app.applied_at ?? app.created_at;
              return (
                <Box
                  key={app.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.25,
                    borderRadius: 3,
                    border: '1px solid #e5eeff',
                    bgcolor: '#f8f9ff',
                    transition: 'background 0.15s',
                    '&:hover': { bgcolor: '#eff4ff' },
                  }}
                >
                  {/* Company icon placeholder */}
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      bgcolor: '#e5eeff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: '#004ac6',
                    }}
                  >
                    <BusinessIcon sx={{ fontSize: 20 }} />
                  </Box>

                  {/* Text */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      noWrap
                      color="text.primary"
                      sx={{ lineHeight: 1.3 }}
                    >
                      {`Job #${app.job_id.slice(0, 8)}…`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {timeAgo(when)}
                    </Typography>
                  </Box>

                  {/* Status chip */}
                  <Chip
                    label={app.status.replace('_', ' ').toUpperCase()}
                    size="small"
                    sx={{
                      bgcolor: style.bgcolor,
                      color: style.color,
                      fontWeight: 700,
                      fontSize: '0.65rem',
                      height: 22,
                      letterSpacing: '0.04em',
                    }}
                  />
                </Box>
              );
            })
          )}
        </Box>

        {/* Footer */}
        <Button
          variant="text"
          fullWidth
          sx={{
            mt: 2,
            color: '#004ac6',
            fontWeight: 600,
            fontSize: '0.85rem',
            textTransform: 'none',
          }}
        >
          View all activity
        </Button>
      </CardContent>
    </Card>
  );
}

export default RecentApplications;
