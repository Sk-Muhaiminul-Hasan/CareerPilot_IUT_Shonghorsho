import type { Job } from './job';

export interface SuggestedTodo {
  id: string;
  title: string;
  due_date: string | null;
  priority: number;
  is_completed: boolean;
}

export interface NudgeResponse {
  headline: string;
  bullets: string[];
  type: 'active' | 'inactive';
  applications_this_week: number;
  recommended_jobs: Job[];
  suggested_todos: SuggestedTodo[];
}
