/**
 * Dashboard service — Goals, Calendar Events, and Weekly Progress.
 *
 * Connects to the backend APIs for goals and calendar events.
 * Weekly Progress remains mocked until an endpoint is available.
 */
import type { Goal, CalendarEvent, WeeklyProgress } from '@/types/dashboard';
import api from './api';

export function toLocalMidnight(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

export function toDateStringFromBackend(datetimeStr: string | null | undefined): string {
  if (!datetimeStr) return '';
  const dateObj = new Date(datetimeStr);
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
}

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
      dueDate: backendGoal.due_date || null,
      colorVariant: backendGoal.color_variant,
      priority: backendGoal.priority || 'Medium',
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
      const dateStr = toDateStringFromBackend(backendEvent.event_date);

      let timeStr: string | undefined = undefined;
      const dateObj = new Date(backendEvent.event_date);
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
      event_date: toLocalMidnight(eventDate),
      event_type: 'task',
      all_day: true,
    };
    const { data } = await api.post('/calendar/', payload);
    const dateStr = toDateStringFromBackend(data.event_date);
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
  dueDate: string | null;
  dueLabel?: string | null;
  priority?: string;
}): Promise<Goal | null> {
  try {
    const payload: any = {
      title: data.title,
      target_value: data.targetValue,
      category: data.category,
      color_variant: data.colorVariant,
    };
    if (data.dueDate) payload.due_date = data.dueDate;
    if (data.dueLabel) payload.due_label = data.dueLabel;
    const { data: resp } = await api.post('/goals/', payload);
    return {
      id: resp.id,
      title: resp.title,
      target: resp.target_value,
      current: resp.current_value,
      dueLabel: resp.due_label || 'Ongoing',
      dueDate: resp.due_date || null,
      colorVariant: resp.color_variant,
      priority: data.priority || 'Medium',
    };
  } catch (error) {
    console.error('Failed to create goal:', error);
    return null;
  }
}

/** Update an existing career goal via backend API. */
export async function updateGoal(id: string, data: {
  title?: string;
  targetValue?: number;
  category?: string;
  colorVariant?: string;
  dueDate?: string | null;
  dueLabel?: string | null;
  priority?: string;
}): Promise<Goal | null> {
  try {
    const payload: any = {};
    if (data.title !== undefined) payload.title = data.title;
    if (data.targetValue !== undefined) payload.target_value = data.targetValue;
    if (data.category !== undefined) payload.category = data.category;
    if (data.colorVariant !== undefined) payload.color_variant = data.colorVariant;
    if (data.dueLabel !== undefined) payload.due_label = data.dueLabel;
    if (data.dueDate !== undefined) payload.due_date = data.dueDate;
    const { data: resp } = await api.patch(`/goals/${id}`, payload);
    return {
      id: resp.id,
      title: resp.title,
      target: resp.target_value,
      current: resp.current_value,
      dueLabel: resp.due_label || 'Ongoing',
      dueDate: resp.due_date || null,
      colorVariant: resp.color_variant,
      priority: data.priority || 'Medium',
    };
  } catch (error) {
    console.error('Failed to update goal:', error);
    return null;
  }
}
