/**
 * Dashboard service — Goals, Calendar Events, and Weekly Progress.
 *
 * Connects to the backend APIs for goals and calendar events.
 * Weekly Progress remains mocked until an endpoint is available.
 */
import type { Goal, CalendarEvent, WeeklyProgress } from '@/types/dashboard';
import api from './api';

/** Fetch the user's active career goals. */
export async function getGoals(): Promise<Goal[]> {
  try {
    // The backend returns a paginated GoalListResponse
    const { data } = await api.get<{ items: any[] }>('/goals/');
    return data.items.map((backendGoal) => ({
      id: backendGoal.id,
      title: backendGoal.title,
      target: backendGoal.target_value,
      current: backendGoal.current_value,
      dueLabel: backendGoal.due_label || 'Ongoing',
      colorVariant: backendGoal.color_variant,
    }));
  } catch (error) {
    console.error('Failed to fetch goals:', error);
    return [];
  }
}

/** Fetch upcoming calendar events. */
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    const { data } = await api.get<{ items: any[] }>('/calendar/');
    return data.items.map((backendEvent) => {
      const dateObj = new Date(backendEvent.event_date);
      // Format as YYYY-MM-DD
      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      
      let timeStr: string | undefined = undefined;
      if (!backendEvent.all_day) {
        timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      }

      return {
        id: backendEvent.id,
        title: backendEvent.title,
        date: dateStr,
        time: timeStr,
        type: backendEvent.event_type as CalendarEvent['type'],
        subtitle: backendEvent.description || undefined,
      };
    });
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    return [];
  }
}

/** Fetch weekly progress snapshot. */
export async function getWeeklyProgress(): Promise<WeeklyProgress> {
  // Still returning mock data for now, as this requires a dedicated analytics endpoint
  return {
    roadmapPercent: 68,
    streakDays: 12,
    skillsAdded: 8,
  };
}
