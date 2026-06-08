import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    queryKey: CALENDAR_KEY,
    queryFn: () => dashboardService.getCalendarEvents(),
    staleTime: 60_000,
  });
}

/** Fetch weekly progress snapshot — derived from completed goals. */
export function useWeeklyProgress() {
  return useQuery({
    queryKey: WEEKLY_PROGRESS_KEY,
    queryFn: () => dashboardService.getWeeklyProgress(),
    staleTime: 30_000,
  });
}

/** Fetch the existing roadmap for a goal (loads lazily when goalId is provided). */
export function useRoadmap(goalId: string | null) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'roadmap', goalId],
    queryFn: () => dashboardService.getRoadmap(goalId!),
    enabled: !!goalId,
    staleTime: 30_000,
    retry: false, // 404 means no roadmap yet — don't retry
  });
}

/** Fetch dashboard progress for all active goals with roadmaps. */
export function useDashboardProgress() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'dashboard-progress'],
    queryFn: () => dashboardService.getDashboardProgress(),
    staleTime: 60_000,
  });
}

/** Mutation to complete a roadmap task and automatically refresh all related dashboard data. */
export function useCompleteTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => dashboardService.completeRoadmapTask(taskId),
    onSuccess: () => {
      // Invalidate dashboard progress widget
      queryClient.invalidateQueries({ queryKey: [...DASHBOARD_KEY, 'dashboard-progress'] });
      // Invalidate any loaded roadmap queries so flowcharts update
      queryClient.invalidateQueries({ queryKey: [...DASHBOARD_KEY, 'roadmap'] });
      // Invalidate active/completed goals list
      queryClient.invalidateQueries({ queryKey: [...DASHBOARD_KEY, 'goals'] });
      queryClient.invalidateQueries({ queryKey: [...DASHBOARD_KEY, 'goals-completed'] });
      queryClient.invalidateQueries({ queryKey: [...DASHBOARD_KEY, 'weekly-progress'] });
    },
  });
}
