export interface ScheduledSearch {
  id: string;
  user_id: string;
  query: string;
  location: string | null;
  platforms: string[];
  schedule: string;
  is_active: boolean;
  last_run: string | null;
  next_run: string;
  created_at: string;
  updated_at: string;
}

export const SCHEDULE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monday', label: 'Every Monday' },
  { value: 'wednesday', label: 'Every Wednesday' },
  { value: 'friday', label: 'Every Friday' },
] as const;
