import { useQuery } from '@tanstack/react-query';
import * as dashboardService from '@/services/dashboardService';

const DASHBOARD_KEY = ['dashboard'] as const;

/** Fetch the user's active career goals. */
export function useGoals() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'goals'],
    queryFn: () => dashboardService.getGoals(),
    staleTime: 60_000,
  });
}

/** Fetch the user's completed goals. */
export function useCompletedGoals() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'goals-completed'],
    queryFn: () => dashboardService.getCompletedGoals(),
    staleTime: 60_000,
  });
}

/** Fetch upcoming calendar events. */
export function useCalendarEvents() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'events'],
    queryFn: () => dashboardService.getCalendarEvents(),
    staleTime: 60_000,
  });
}

/** Fetch weekly progress snapshot — derived from completed goals. */
export function useWeeklyProgress() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'weekly-progress'],
    queryFn: () => dashboardService.getWeeklyProgress(),
    staleTime: 30_000,
  });
}

