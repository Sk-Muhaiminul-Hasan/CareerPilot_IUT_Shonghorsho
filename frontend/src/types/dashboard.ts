/**
 * Dashboard-specific types for Goals, Calendar Events, and Weekly Progress.
 * These types are backend-ready: when the API endpoints exist, only the
 * service functions in dashboardService.ts need to be updated.
 */

/** A single career goal with progress tracking. */
export interface Goal {
  id: string;
  title: string;
  /** Numerical target (e.g. 5 applications, 20 exercises). */
  target: number;
  /** Current progress value. */
  current: number;
  /** Human-readable due date string, or "Ongoing". */
  dueLabel: string;
  /** Color variant for the progress bar: 'primary' | 'secondary' | 'tertiary'. */
  colorVariant: 'primary' | 'secondary' | 'tertiary';
}

/** Category of a calendar event. */
export type CalendarEventType = 'interview' | 'deadline' | 'task' | 'session';

/** A single upcoming calendar event. */
export interface CalendarEvent {
  id: string;
  title: string;
  /** ISO date string, e.g. "2024-06-16". */
  date: string;
  /** Short time string, e.g. "2:30 PM". */
  time?: string;
  type: CalendarEventType;
  /** Optional subtitle / description. */
  subtitle?: string;
}

/** Weekly progress snapshot shown in the Progress tile. */
export interface WeeklyProgress {
  /** Roadmap completion percentage (0–100). */
  roadmapPercent: number;
  /** Current application streak in days. */
  streakDays: number;
  /** Number of new skills added this week. */
  skillsAdded: number;
}

/** A single to-do item, optionally linked to a goal or calendar event. */
export interface Todo {
  id: string;
  title: string;
  description?: string;
  /** ISO date string or null. */
  dueDate: string | null;
  priority: 1 | 2 | 3;
  status: string;
  isCompleted: boolean;
  createdAt: string;
}
