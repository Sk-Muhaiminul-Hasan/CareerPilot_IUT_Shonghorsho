import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as todoService from '@/services/todoService';

const DASHBOARD_KEY = ['dashboard'] as const;

export function useTodos(status?: string, goalId?: string) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'todos', status ?? 'all', goalId ?? 'all'],
    queryFn: () => todoService.getTodos(status as any, goalId),
    staleTime: 30_000,
  });
}

export function useCreateTodo(status?: string, goalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; due_date?: string; priority?: 1 | 2 | 3 }) =>
      todoService.createTodo(input, goalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...DASHBOARD_KEY, 'todos'] });
      qc.invalidateQueries({ queryKey: [...DASHBOARD_KEY, 'events'] });
    },
  });
}

export function useUpdateTodo(status?: string, goalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { is_completed?: boolean } }) =>
      todoService.updateTodo(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...DASHBOARD_KEY, 'todos'] });
      qc.invalidateQueries({ queryKey: [...DASHBOARD_KEY, 'events'] });
    },
  });
}

export function useDeleteTodo(status?: string, goalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => todoService.deleteTodo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...DASHBOARD_KEY, 'todos'] });
    },
  });
}
