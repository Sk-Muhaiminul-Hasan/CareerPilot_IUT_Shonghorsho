import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import type { ReactElement } from 'react';

export interface KpiCardProps {
  label: string;
  value: string;
  subText?: string;
  subTextColor?: string;
  icon: ReactElement;
  /** Background color for the icon box (hex with opacity built-in, or rgba). */
  iconBgColor: string;
  /** Icon tint color. */
  iconColor: string;
  loading?: boolean;
}

/**
 * Reusable KPI stat card — icon on the left, label + value + sub-text on the right.
 * Matches the four top metric cards from Designs/screen.png.
 */
function KpiCard({
  label,
  value,
  subText,
  subTextColor = '#434655',
  icon,
  iconBgColor,
  iconColor,
  loading = false,
}: KpiCardProps) {
  return (
    <Card>
      <CardContent sx={{ p: '20px !important', display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* Icon badge */}
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 3,
            bgcolor: iconBgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor,
            flexShrink: 0,
            '& svg': { fontSize: 26 },
          }}
        >
          {icon}
        </Box>

        {/* Text */}
        <Box>
          <Typography
            variant="caption"
            sx={{
              textTransform: 'uppercase',
              color: 'text.secondary',
              fontWeight: 600,
              letterSpacing: '0.06em',
              lineHeight: 1,
            }}
          >
            {label}
          </Typography>

          {loading ? (
            <Skeleton variant="text" width={80} height={40} />
          ) : (
            <Typography
              variant="h4"
              sx={{ fontWeight: 700, lineHeight: 1.15, mt: 0.25, color: 'text.primary' }}
            >
              {value}
            </Typography>
          )}

          {subText && !loading && (
            <Typography
              variant="caption"
              sx={{ color: subTextColor, fontWeight: 600, display: 'block', mt: 0.25 }}
            >
              {subText}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export default KpiCard;
