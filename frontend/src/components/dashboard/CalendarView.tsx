/**
 * Full-page calendar view for the Dashboard's "Calendar" tab.
 * Shows a monthly calendar grid with event dots, today's agenda panel,
 * and a quick-add section.
 *
 * Data comes from useCalendarEvents() — swap dashboardService.ts for real API calls.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import DeleteIcon from '@mui/icons-material/Delete';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';

import type { CalendarEvent } from '@/types/dashboard';
// ✅ MERGED: CALENDAR_KEY from wasi-not-final + updateCalendarEvent/deleteCalendarEvent
//    from home_page_with_auth (needed for toggle complete + delete buttons)
//    Removed local DASHBOARD_KEY constant — use imported CALENDAR_KEY everywhere
import { useCalendarEvents, CALENDAR_KEY } from '@/hooks/useDashboard';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '@/services/dashboardService';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EVENT_DOT_COLOR: Record<CalendarEvent['type'], string> = {
  interview: '#004ac6',
  deadline: '#712ae2',
  session: '#004ac6',
  task: '#1a7f4b',
};

const EVENT_CHIP_COLOR: Record<CalendarEvent['type'], { bg: string; color: string }> = {
  interview: { bg: '#dbe1ff', color: '#004ac6' },
  deadline: { bg: '#eaddff', color: '#712ae2' },
  session: { bg: '#e5eeff', color: '#004ac6' },
  task: { bg: '#dcfce7', color: '#1a7f4b' },
};

/** Build a 6-row × 7-col calendar grid for the given month/year. */
function buildCalendarGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function CalendarView() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [quickAdd, setQuickAdd] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);

  const queryClient = useQueryClient();
  const { data: events = [] } = useCalendarEvents();

  const [priority, setPriority] = useState<'High' | 'Medium' | 'Normal'>('Normal');

  const grid = buildCalendarGrid(viewYear, viewMonth);

  function eventsOnDay(date: Date) {
    return events.filter((e) => {
      const [y, m, d] = e.date.split('-').map(Number) as [number, number, number];
      return isSameDay(new Date(y, m - 1, d), date);
    });
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  async function handleSchedule() {
    if (!quickAdd.trim()) return;
    setIsScheduling(true);
    try {
      const eventDate = new Date(selectedDate);
      eventDate.setHours(12, 0, 0, 0);
      await createCalendarEvent(quickAdd.trim(), eventDate, priority);
      setQuickAdd('');
      // ✅ MERGED: kept setPriority reset from home_page_with_auth
      //           + CALENDAR_KEY from wasi-not-final (replaces stale DASHBOARD_KEY)
      setPriority('Normal');
      await queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
    } catch {
      // error already logged in service
    } finally {
      setIsScheduling(false);
    }
  }

  async function handleToggleComplete(eventId: string, isCompleted: boolean) {
    try {
      await updateCalendarEvent(eventId, { is_completed: isCompleted });
      // ✅ FIXED: was [...DASHBOARD_KEY, 'events'] — now uses CALENDAR_KEY
      await queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
    } catch (error) {
      console.error('Failed to toggle completion:', error);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    try {
      await deleteCalendarEvent(eventId);
      // ✅ FIXED: was [...DASHBOARD_KEY, 'events'] — now uses CALENDAR_KEY
      await queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  }

  const selectedEvents = eventsOnDay(selectedDate);
  const todayEvents = eventsOnDay(today);

  return (
    <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'flex-start' }}>
      {/* ── Main calendar grid ──────────────────────────────── */}
      <Card sx={{ flex: 1 }}>
        <CardContent sx={{ p: '24px !important' }}>
          {/* Month nav */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" fontWeight={700}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Typography>
              <IconButton size="small" onClick={prevMonth} sx={{ ml: 1 }}>
                <ChevronLeftIcon />
              </IconButton>
              <IconButton size="small" onClick={nextMonth}>
                <ChevronRightIcon />
              </IconButton>
            </Box>
            {/* Legend */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              {(['interview', 'deadline', 'session'] as const).map((t) => (
                <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: EVENT_DOT_COLOR[t] }} />
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                    {t === 'session' ? 'Sessions' : t === 'interview' ? 'Interviews' : 'Deadlines'}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Day-name header */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 1 }}>
            {DAY_NAMES.map((d) => (
              <Typography key={d} variant="caption" align="center" color="text.secondary" fontWeight={600}
                sx={{ pb: 1, borderBottom: '1px solid #e2e8f0' }}>
                {d}
              </Typography>
            ))}
          </Box>

          {/* Calendar rows */}
          {grid.map((row, ri) => (
            <Box key={ri} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {row.map((date, ci) => {
                const isToday = date ? isSameDay(date, today) : false;
                const isSelected = date ? isSameDay(date, selectedDate) : false;
                const dayEvents = date ? eventsOnDay(date) : [];
                const isCurrentMonth = date ? date.getMonth() === viewMonth : false;

                return (
                  <Box
                    key={ci}
                    onClick={() => date && setSelectedDate(date)}
                    sx={{
                      height: 84,
                      overflow: 'hidden',
                      p: 0.75,
                      borderBottom: '1px solid #f1f5f9',
                      borderRight: ci < 6 ? '1px solid #f1f5f9' : 'none',
                      cursor: date ? 'pointer' : 'default',
                      bgcolor: isSelected && !isToday ? '#eff4ff' : 'transparent',
                      transition: 'background 0.1s',
                      '&:hover': date ? { bgcolor: isToday ? undefined : '#f8f9ff' } : {},
                    }}
                  >
                    {date && (
                      <>
                        <Box
                          sx={{
                            width: 28, height: 28,
                            borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: isToday ? '#004ac6' : 'transparent',
                            mb: 0.5,
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight={isToday ? 700 : isCurrentMonth ? 500 : 400}
                            sx={{ color: isToday ? '#fff' : isCurrentMonth ? 'text.primary' : 'text.disabled' }}
                          >
                            {date.getDate()}
                          </Typography>
                        </Box>
                        {/* Event pills */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          {dayEvents.slice(0, 2).map((ev) => (
                            <Box
                              key={ev.id}
                              sx={{
                                px: 0.75, py: 0.15,
                                borderRadius: 1,
                                bgcolor: EVENT_CHIP_COLOR[ev.type].bg,
                                maxWidth: '100%',
                                opacity: ev.isCompleted ? 0.6 : 1,
                              }}
                            >
                              <Typography
                                noWrap
                                sx={{
                                  fontSize: '0.6rem',
                                  fontWeight: 600,
                                  color: EVENT_CHIP_COLOR[ev.type].color,
                                  lineHeight: 1.4,
                                  textDecoration: ev.isCompleted ? 'line-through' : 'none',
                                }}
                              >
                                {ev.title}
                              </Typography>
                            </Box>
                          ))}
                          {dayEvents.length > 2 && (
                            <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                              +{dayEvents.length - 2} more
                            </Typography>
                          )}
                        </Box>
                      </>
                    )}
                  </Box>
                );
              })}
            </Box>
          ))}
        </CardContent>
      </Card>

      {/* ── Right panel ─────────────────────────────────────── */}
      <Box sx={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Today's agenda */}
        <Card>
          <CardContent sx={{ p: '20px !important' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                {isSameDay(selectedDate, today) ? "Today's Agenda" : selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Typography>
              <Chip
                label={selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                size="small"
                sx={{ bgcolor: '#004ac6', color: '#fff', fontWeight: 700, fontSize: '0.7rem' }}
              />
            </Box>

            {selectedEvents.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nothing scheduled — a free day!
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {selectedEvents.map((ev) => {
                  const chipStyle = EVENT_CHIP_COLOR[ev.type];
                  return (
                    <Box
                      key={ev.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        borderLeft: `3px solid ${chipStyle.color}`,
                        pl: 1,
                        py: 0.5,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
                        <Checkbox
                          size="small"
                          checked={!!ev.isCompleted}
                          onChange={(e) => handleToggleComplete(ev.id, e.target.checked)}
                          sx={{
                            p: 0.5,
                            color: chipStyle.color,
                            '&.Mui-checked': { color: chipStyle.color },
                          }}
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          {ev.time && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              fontWeight={600}
                              sx={{ textDecoration: ev.isCompleted ? 'line-through' : 'none' }}
                            >
                              {ev.time}
                            </Typography>
                          )}
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            color={ev.isCompleted ? 'text.disabled' : 'text.primary'}
                            sx={{
                              textDecoration: ev.isCompleted ? 'line-through' : 'none',
                              wordBreak: 'break-word',
                            }}
                          >
                            {ev.title}
                          </Typography>
                          {ev.subtitle && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                              {['High', 'Medium', 'Normal'].includes(ev.subtitle) ? (
                                <Chip
                                  label={`${ev.subtitle} Priority`}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    bgcolor: ev.subtitle === 'High' ? '#fde8e8' : ev.subtitle === 'Medium' ? '#fff4db' : '#e5eeff',
                                    color: ev.subtitle === 'High' ? '#dc2626' : ev.subtitle === 'Medium' ? '#b45309' : '#004ac6',
                                    textDecoration: ev.isCompleted ? 'line-through' : 'none',
                                  }}
                                />
                              ) : (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ textDecoration: ev.isCompleted ? 'line-through' : 'none' }}
                                >
                                  {ev.subtitle}
                                </Typography>
                              )}
                            </Box>
                          )}
                        </Box>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteEvent(ev.id)}
                        sx={{
                          color: 'text.secondary',
                          '&:hover': { color: 'error.main' },
                          p: 0.5,
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  );
                })}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Quick Add */}
        <Card sx={{ background: 'linear-gradient(135deg, #004ac6 0%, #712ae2 100%)' }}>
          <CardContent sx={{ p: '20px !important' }}>
            <Typography variant="subtitle1" fontWeight={700} color="#fff" sx={{ mb: 1.5 }}>
              Quick Add
            </Typography>
            <TextField
              placeholder="Event name..."
              size="small"
              fullWidth
              value={quickAdd}
              onChange={(e) => setQuickAdd(e.target.value)}
              sx={{
                mb: 1.5,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.6)' },
                  '&.Mui-focused fieldset': { borderColor: '#fff' },
                },
                '& input::placeholder': { color: 'rgba(255,255,255,0.6)' },
              }}
            />
            <FormControl
              size="small"
              fullWidth
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.6)' },
                  '&.Mui-focused fieldset': { borderColor: '#fff' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.8)' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
                '& .MuiSelect-icon': { color: '#fff' }
              }}
            >
              <InputLabel id="quick-add-priority-label">Priority</InputLabel>
              <Select
                labelId="quick-add-priority-label"
                value={priority}
                label="Priority"
                onChange={(e) => setPriority(e.target.value as 'High' | 'Medium' | 'Normal')}
              >
                <MenuItem value="Normal">Normal</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="High">High</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              fullWidth
              disabled={isScheduling || !quickAdd.trim()}
              onClick={handleSchedule}
              sx={{
                bgcolor: '#fff',
                color: '#004ac6',
                fontWeight: 700,
                textTransform: 'none',
                '&:hover': { bgcolor: '#eff4ff' },
                '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.5)', color: 'rgba(0,74,198,0.5)' },
              }}
            >
              {isScheduling ? 'Scheduling...' : 'Schedule'}
            </Button>
          </CardContent>
        </Card>

        {/* Today's events count */}
        {todayEvents.length > 0 && (
          <Card>
            <CardContent sx={{ p: '16px !important' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Today
              </Typography>
              <Typography variant="h4" fontWeight={800} color="#004ac6">
                {todayEvents.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {todayEvents.length === 1 ? 'event scheduled' : 'events scheduled'}
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
}