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
    const { data } = await api.get<{ items: any[] }>('/goals/?status=active');
    return data.items.map((backendGoal) => ({
      id: backendGoal.id,
      title: backendGoal.title,
      target: backendGoal.target_value,
      current: backendGoal.current_value,
      dueLabel: backendGoal.due_label || 'Ongoing',
      dueDate: backendGoal.due_date || null,
      colorVariant: backendGoal.color_variant,
      // ✅ KEPT from home_page_with_auth — proper TS cast + all required fields
      priority: (backendGoal.priority as Goal['priority']) || 'Medium',
      status: backendGoal.status ?? 'active',
      category: backendGoal.category ?? 'other',
      completedAt: backendGoal.completed_at || null,
    }));
  } catch (error) {
    console.error('Failed to fetch goals:', error);
    return [];
  }
}

/** Fetch the user's completed goals. */
export async function getCompletedGoals(): Promise<Goal[]> {
  try {
    const { data } = await api.get<{ items: any[] }>('/goals/?status=completed');
    return data.items.map((backendGoal) => ({
      id: backendGoal.id,
      title: backendGoal.title,
      target: backendGoal.target_value,
      current: backendGoal.current_value,
      dueLabel: backendGoal.due_label || 'Ongoing',
      dueDate: backendGoal.due_date || null,
      colorVariant: backendGoal.color_variant,
      priority: (backendGoal.priority as Goal['priority']) || 'Medium',
      status: 'completed' as const,
      category: backendGoal.category ?? 'other',
      completedAt: backendGoal.completed_at || null,
    }));
  } catch (error) {
    console.error('Failed to fetch completed goals:', error);
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
        isCompleted: backendEvent.is_completed,
      };
    });
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    return [];
  }
}

/** Fetch weekly progress snapshot — derived from goal data where possible. */
export async function getWeeklyProgress(): Promise<WeeklyProgress> {
  try {
    const completed = await getCompletedGoals();
    const skillsAdded = completed.filter((g) => g.category === 'learning').length;
    const streakDays = completed.length;
    const activeData = await api.get<{ total: number }>('/goals/?status=active');
    const totalGoals = (activeData.data?.total ?? 0) + completed.length;
    const roadmapPercent = totalGoals > 0 ? Math.round((completed.length / totalGoals) * 100) : 0;
    return { roadmapPercent, streakDays, skillsAdded };
  } catch {
    return { roadmapPercent: 0, streakDays: 0, skillsAdded: 0 };
  }
}


/** Create a new calendar event via backend API. */
export async function createCalendarEvent(title: string, eventDate: Date, description?: string): Promise<CalendarEvent | null> {
  try {
    const payload = {
      title,
      event_date: toLocalMidnight(eventDate),
      event_type: 'task',
      all_day: true,
      description: description || undefined,
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
      isCompleted: data.is_completed,
    };
  } catch (error) {
    console.error('Failed to create calendar event:', error);
    return null;
  }
}

/** Update an existing calendar event (e.g. marking it completed) via backend API. */
export async function updateCalendarEvent(id: string, updates: { is_completed?: boolean; title?: string }): Promise<CalendarEvent | null> {
  try {
    const { data } = await api.patch(`/calendar/${id}`, updates);
    const dateObj = new Date(data.event_date);
    const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    return {
      id: data.id,
      title: data.title,
      date: dateStr,
      time: data.all_day ? undefined : dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      type: data.event_type,
      subtitle: data.description || undefined,
      isCompleted: data.is_completed,
    };
  } catch (error) {
    console.error('Failed to update calendar event:', error);
    return null;
  }
}

/** Delete a calendar event via backend API. */
export async function deleteCalendarEvent(id: string): Promise<boolean> {
  try {
    await api.delete(`/calendar/${id}`);
    return true;
  } catch (error) {
    console.error('Failed to delete calendar event:', error);
    return false;
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
      priority: (data.priority as Goal['priority']) || 'Medium',
      status: resp.status ?? 'active',
      category: resp.category ?? 'other',
      completedAt: resp.completed_at || null,
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
  status?: string;
}): Promise<Goal | null> {
  try {
    const payload: any = {};
    if (data.title !== undefined) payload.title = data.title;
    if (data.targetValue !== undefined) payload.target_value = data.targetValue;
    if (data.category !== undefined) payload.category = data.category;
    if (data.colorVariant !== undefined) payload.color_variant = data.colorVariant;
    if (data.dueLabel !== undefined) payload.due_label = data.dueLabel;
    if (data.dueDate !== undefined) payload.due_date = data.dueDate;
    if (data.status !== undefined) payload.status = data.status;
    const { data: resp } = await api.patch(`/goals/${id}`, payload);
    return {
      id: resp.id,
      title: resp.title,
      target: resp.target_value,
      current: resp.current_value,
      dueLabel: resp.due_label || 'Ongoing',
      dueDate: resp.due_date || null,
      colorVariant: resp.color_variant,
      priority: (data.priority as Goal['priority']) || 'Medium',
      status: resp.status ?? 'active',
      category: resp.category ?? 'other',
      completedAt: resp.completed_at || null,
    };
  } catch (error) {
    console.error('Failed to update goal:', error);
    return null;
  }
}

/** Mark a goal as completed. */
export async function completeGoal(id: string): Promise<Goal | null> {
  return updateGoal(id, { status: 'completed' });
}

/** Delete a career goal via backend API. */
export async function deleteGoalById(id: string): Promise<boolean> {
  try {
    await api.delete(`/goals/${id}`);
    return true;
  } catch (error) {
    console.error('Failed to delete goal:', error);
    return false;
  }
}