import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as todoService from '@/services/todoService';
import * as dashboard from '@/hooks/useDashboard';

export function useTodos(status?: string, goalId?: string) {
  return useQuery({
    queryKey: [...dashboard.DASHBOARD_KEY, 'todos', status ?? 'all', goalId ?? 'all'],
    queryFn: () => todoService.getTodos(status as any, goalId),
    staleTime: 30_000,
  });
}

export function useCreateTodo(_status?: string, goalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; due_date?: string; priority?: 1 | 2 | 3 }) =>
      todoService.createTodo(input, goalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...dashboard.DASHBOARD_KEY, 'todos'] });
      qc.invalidateQueries({ queryKey: dashboard.CALENDAR_KEY });
    },
  });
}

export function useUpdateTodo(_status?: string, _goalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { is_completed?: boolean } }) =>
      todoService.updateTodo(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...dashboard.DASHBOARD_KEY, 'todos'] });
      qc.invalidateQueries({ queryKey: dashboard.CALENDAR_KEY });
    },
  });
}

export function useDeleteTodo(_status?: string, _goalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => todoService.deleteTodo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...dashboard.DASHBOARD_KEY, 'todos'] });
    },
  });
}
