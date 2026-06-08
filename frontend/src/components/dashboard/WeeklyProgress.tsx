import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import MapIcon from '@mui/icons-material/Map';
import BoltIcon from '@mui/icons-material/Bolt';
import PsychologyIcon from '@mui/icons-material/Psychology';

import type { WeeklyProgress as WeeklyProgressType } from '@/types/dashboard';

interface WeeklyProgressProps {
  data: WeeklyProgressType | undefined;
  loading?: boolean;
}

/**
 * Weekly Progress bento tile — three sub-tiles:
 * ROADMAP %, STREAK (days + bolt icon), and a dark SKILLS ADDED card.
 * Matches the bottom-center section of Designs/screen.png.
 */
function WeeklyProgress({ data, loading = false }: WeeklyProgressProps) {
  const roadmap = data?.roadmapPercent ?? 0;
  const streak = data?.streakDays ?? 0;
  const skills = data?.skillsAdded ?? 0;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: '24px !important', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" fontWeight={700} color="text.primary" sx={{ mb: 2 }}>
          Weekly Progress
        </Typography>

        {/* Top row: Roadmap + Streak side by side */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          {/* Roadmap tile */}
          <Box
            sx={{
              flex: 1,
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
            }}
          >
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Roadmap
            </Typography>
            {loading ? (
              <Skeleton variant="text" width={70} height={36} />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: '#bc4800', lineHeight: 1 }}>
                  {roadmap}%
                </Typography>
                <MapIcon sx={{ color: '#bc4800', fontSize: 20 }} />
              </Box>
            )}
          </Box>

          {/* Streak tile */}
          <Box
            sx={{
              flex: 1,
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
            }}
          >
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Streak
            </Typography>
            {loading ? (
              <Skeleton variant="text" width={70} height={36} />
            ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: '#0b1c30', lineHeight: 1 }}>
                  {streak}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <BoltIcon sx={{ color: '#f59e0b', fontSize: 18 }} />
                  <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', lineHeight: 1, fontWeight: 600 }}>goals</Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Box>

        {/* Dark Skills Added card */}
        <Box
          sx={{
            borderRadius: 3,
            background: 'linear-gradient(135deg, #0b1c30 0%, #213145 100%)',
            p: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography
              variant="caption"
              sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              Skills Added
            </Typography>
            {loading ? (
              <Skeleton variant="text" width={80} height={40} sx={{ bgcolor: 'rgba(255,255,255,0.15)' }} />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 0.25 }}>
                <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>
                  {String(skills).padStart(2, '0')}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
                  from goals
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              bgcolor: 'rgba(113, 42, 226, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PsychologyIcon sx={{ color: '#d2bbff', fontSize: 24 }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default WeeklyProgress;
