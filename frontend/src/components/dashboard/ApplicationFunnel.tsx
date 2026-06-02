import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';

import type { ApplicationFunnelData } from '@/types/analytics';

interface ApplicationFunnelProps {
  data: ApplicationFunnelData[] | undefined;
  loading?: boolean;
}

/**
 * Stage config — maps stage names (from backend) to display labels and colors.
 * Add entries here when new funnel stages are introduced.
 */
const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'PENDING', color: '#004ac6' },
  queued: { label: 'PENDING', color: '#004ac6' },
  pending_review: { label: 'PENDING', color: '#004ac6' },
  approved: { label: 'APPROVED', color: '#004ac6' },
  applying: { label: 'APPROVED', color: '#004ac6' },
  applied: { label: 'APPLIED', color: '#712ae2' },
  interview: { label: 'INTERVIEW', color: '#943700' },
  offer: { label: 'OFFER', color: '#1a7f4b' },
  rejected: { label: 'REJECTED', color: '#737686' },
};

/** Canonical funnel stages in display order. */
const FUNNEL_STAGES = [
  { key: 'pending', label: 'PENDING', color: '#004ac6' },
  { key: 'approved', label: 'APPROVED', color: '#004ac6' },
  { key: 'applied', label: 'APPLIED', color: '#712ae2' },
  { key: 'interview', label: 'INTERVIEW', color: '#943700' },
  { key: 'offer', label: 'OFFER', color: '#1a7f4b' },
];

function getCounts(data: ApplicationFunnelData[] | undefined) {
  if (!data) return { pending: 0, approved: 0, applied: 0, interview: 0, offer: 0 };

  const counts: Record<string, number> = { pending: 0, approved: 0, applied: 0, interview: 0, offer: 0 };
  for (const entry of data) {
    const key = entry.stage.toLowerCase();
    const cfg = STAGE_CONFIG[key];
    if (cfg) {
      // Map multiple backend stages to canonical display keys
      const displayKey = cfg.label.toLowerCase();
      if (displayKey in counts) counts[displayKey] = (counts[displayKey] ?? 0) + entry.count;
    }
  }
  return counts;
}

function ApplicationFunnel({ data, loading = false }: ApplicationFunnelProps) {
  const counts = getCounts(data);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: '24px !important', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={700} color="text.primary">
              Application Funnel
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Pipeline health across all stages
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            sx={{
              borderColor: '#c3c6d7',
              color: 'text.secondary',
              fontSize: '0.75rem',
              borderRadius: 2,
              px: 1.5,
              py: 0.5,
              minWidth: 0,
              '&:hover': { borderColor: '#004ac6', color: '#004ac6' },
            }}
          >
            Last 30 Days
          </Button>
        </Box>

        {/* Visual funnel bars */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', py: 2 }}>
          {FUNNEL_STAGES.map((stage, idx) => {
            const count = counts[stage.label.toLowerCase()] ?? 0;
            const maxCount = Math.max(...FUNNEL_STAGES.map((s) => counts[s.label.toLowerCase()] ?? 0), 1);
            const barWidth = Math.max((count / maxCount) * 100, 4);

            return (
              <Box key={stage.key} sx={{ mb: idx < FUNNEL_STAGES.length - 1 ? 1.5 : 0 }}>
                <Box
                  sx={{
                    height: 10,
                    bgcolor: `${stage.color}20`,
                    borderRadius: 9999,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      width: `${barWidth}%`,
                      height: '100%',
                      bgcolor: stage.color,
                      borderRadius: 9999,
                      transition: 'width 0.6s ease',
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Bottom count row */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            pt: 2,
            borderTop: '1px solid #e2e8f0',
          }}
        >
          {FUNNEL_STAGES.map((stage) => {
            const count = counts[stage.label.toLowerCase()] ?? 0;
            return (
              <Box key={stage.key} sx={{ textAlign: 'center' }}>
                {loading ? (
                  <Skeleton variant="text" width={32} height={32} sx={{ mx: 'auto' }} />
                ) : (
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: '1.25rem',
                      color: stage.color,
                      lineHeight: 1,
                    }}
                  >
                    {count}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {stage.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}

export default ApplicationFunnel;
