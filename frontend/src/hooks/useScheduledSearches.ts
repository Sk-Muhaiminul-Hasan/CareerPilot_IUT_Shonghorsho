import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as scheduledService from '@/services/scheduledSearchService';
import type { ScheduledSearchCreate, ScheduledSearchUpdate } from '@/types/scheduledSearch';

const SCHEDULED_SEARCHES_KEY = ['scheduled_searches'] as const;

export function useScheduledSearches() {
  return useQuery({
    queryKey: SCHEDULED_SEARCHES_KEY,
    queryFn: () => scheduledService.listScheduledSearches(),
  });
}

export function useCreateScheduledSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScheduledSearchCreate) =>
      scheduledService.createScheduledSearch(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHEDULED_SEARCHES_KEY });
    },
  });
}

export function useUpdateScheduledSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ searchId, payload }: { searchId: string; payload: ScheduledSearchUpdate }) =>
      scheduledService.updateScheduledSearch(searchId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHEDULED_SEARCHES_KEY });
    },
  });
}

export function useDeleteScheduledSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (searchId: string) => scheduledService.deleteScheduledSearch(searchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHEDULED_SEARCHES_KEY });
    },
  });
}
