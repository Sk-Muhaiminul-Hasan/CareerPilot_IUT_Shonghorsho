import { useQuery } from '@tanstack/react-query';
import * as dashboardService from '@/services/dashboardService';

import { useQuery } from '@tanstack/react-query';
import * as dashboardService from '@/services/dashboardService';

export const DASHBOARD_KEY = ['dashboard'] as const;
export const GOALS_KEY = [...DASHBOARD_KEY, 'goals'] as const;
export const CALENDAR_KEY = [...DASHBOARD_KEY, 'calendar'] as const;
export const WEEKLY_PROGRESS_KEY = [...DASHBOARD_KEY, 'weekly-progress'] as const;

/** Fetch the user's active career goals. */
export function useGoals() {
  return useQuery({
    queryKey: GOALS_KEY,
    queryFn: () => dashboardService.getGoals(),
    staleTime: 60_000,
  });
}

/** Fetch upcoming calendar events. */
export function useCalendarEvents() {
  return useQuery({
    queryKey: CALENDAR_KEY,
    queryFn: () => dashboardService.getCalendarEvents(),
    staleTime: 60_000,
  });
}

/** Fetch weekly progress snapshot. */
export function useWeeklyProgress() {
  return useQuery({
    queryKey: WEEKLY_PROGRESS_KEY,
    queryFn: () => dashboardService.getWeeklyProgress(),
    staleTime: 30_000,
  });
}
