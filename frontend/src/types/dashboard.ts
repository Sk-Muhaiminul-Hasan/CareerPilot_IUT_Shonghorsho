/**
 * Dashboard-specific types for Goals, Calendar Events, and Weekly Progress.
 * These types are backend-ready: when the API endpoints exist, only the
 * service functions in dashboardService.ts need to be updated.
 */

export type GoalStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type GoalCategory = 'applications' | 'learning' | 'networking' | 'interview_prep' | 'other';

/** A single career goal with progress tracking. */
export interface Goal {
  id: string;
  title: string;
  target: number;
  current: number;
  dueLabel: string;
  dueDate: string | null;
  colorVariant: 'primary' | 'secondary' | 'tertiary';
  priority: 'Low' | 'Medium' | 'High';
  /** Backend status: active | paused | completed | cancelled */
  status: GoalStatus;
  /** Goal category used to classify skills learned. */
  category: GoalCategory;
  /** ISO string set when the goal was completed. */
  completedAt: string | null;
}

/** Category of a calendar event. */
export type CalendarEventType = 'interview' | 'deadline' | 'task' | 'session';

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
  /** Whether the task or event is marked completed. */
  isCompleted?: boolean;
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
