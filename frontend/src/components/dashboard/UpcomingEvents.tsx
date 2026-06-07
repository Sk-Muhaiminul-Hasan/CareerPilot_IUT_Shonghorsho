import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import EventIcon from '@mui/icons-material/Event';
import AssignmentIcon from '@mui/icons-material/Assignment';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

import type { CalendarEvent } from '@/types/dashboard';

interface UpcomingEventsProps {
  events: CalendarEvent[] | undefined;
  loading?: boolean;
  /** Called when user clicks "Open Calendar" — used to switch to the Calendar tab. */
  onOpenCalendar?: () => void;
}

/** Month abbreviation lookup. */
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function parseDate(dateStr: string) {
  const d = new Date(dateStr);
  return {
    month: MONTHS[d.getMonth()],
    day: d.getDate(),
  };
}

function EventTypeIcon({ type }: { type: CalendarEvent['type'] }) {
  const style = { fontSize: 16 };
  switch (type) {
    case 'interview': return <EventIcon sx={{ ...style, color: '#004ac6' }} />;
    case 'deadline': return <AssignmentIcon sx={{ ...style, color: '#943700' }} />;
    case 'session': return <SmartToyIcon sx={{ ...style, color: '#712ae2' }} />;
    default: return <EventIcon sx={{ ...style, color: '#434655' }} />;
  }
}

/** Badge color per event type. */
const BADGE_COLOR: Record<CalendarEvent['type'], string> = {
  interview: '#004ac6',
  deadline: '#943700',
  session: '#712ae2',
  task: '#1a7f4b',
};

function UpcomingEvents({ events, loading = false, onOpenCalendar }: UpcomingEventsProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: '24px !important', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" fontWeight={700} color="text.primary" sx={{ mb: 2 }}>
          Upcoming
        </Typography>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Skeleton variant="rounded" width={44} height={44} sx={{ borderRadius: 2 }} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="70%" />
                  <Skeleton variant="text" width="50%" />
                </Box>
              </Box>
            ))
          ) : !events || events.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No upcoming events.
            </Typography>
          ) : (
            events.map((event) => {
              const { month, day } = parseDate(event.date);
              const badgeColor = BADGE_COLOR[event.type];
              return (
                <Box
                  key={event.id}
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
                  {/* Date badge */}
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      bgcolor: badgeColor,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Typography sx={{ color: '#fff', fontSize: '0.6rem', fontWeight: 700, lineHeight: 1, letterSpacing: '0.06em' }}>
                      {month}
                    </Typography>
                    <Typography sx={{ color: '#fff', fontSize: '1rem', fontWeight: 800, lineHeight: 1.1 }}>
                      {day}
                    </Typography>
                  </Box>

                  {/* Event info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap color="text.primary" sx={{ lineHeight: 1.3 }}>
                      {event.title}
                    </Typography>
                    {event.subtitle && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                        <EventTypeIcon type={event.type} />
                        <Typography variant="caption" color="text.secondary">
                          {event.subtitle}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })
          )}
        </Box>

        <Button
          startIcon={<CalendarMonthIcon />}
          variant="text"
          fullWidth
          onClick={onOpenCalendar}
          sx={{
            mt: 2,
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.82rem',
            textTransform: 'none',
            '&:hover': { color: '#004ac6' },
          }}
        >
          Open Calendar
        </Button>
      </CardContent>
    </Card>
  );
}

export default UpcomingEvents;
