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
  return {
    roadmapPercent: 68,
    streakDays: 12,
    skillsAdded: 8,
  };
}

/** Create a new calendar event via backend API. */
export async function createCalendarEvent(title: string, eventDate: Date): Promise<CalendarEvent | null> {
  try {
    const payload = {
      title,
      event_date: eventDate.toISOString(),
      event_type: 'task',
      all_day: true,
    };
    const { data } = await api.post('/calendar/', payload);
    const dateObj = new Date(data.event_date);
    const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    return {
      id: data.id,
      title: data.title,
      date: dateStr,
      time: undefined,
      type: data.event_type,
      subtitle: data.description || undefined,
    };
  } catch (error) {
    console.error('Failed to create calendar event:', error);
    return null;
  }
}

/** Create a new career goal via backend API. */
export async function createGoal(data: {
  title: string;
  targetValue: number;
  category: string;
  colorVariant: string;
}): Promise<Goal | null> {
  try {
    const payload = {
      title: data.title,
      target_value: data.targetValue,
      category: data.category,
      color_variant: data.colorVariant,
    };
    const { data: resp } = await api.post('/goals/', payload);
    return {
      id: resp.id,
      title: resp.title,
      target: resp.target_value,
      current: resp.current_value,
      dueLabel: resp.due_label || 'Ongoing',
      colorVariant: resp.color_variant,
    };
  } catch (error) {
    console.error('Failed to create goal:', error);
    return null;
  }
}
