import type { Todo } from '@/types/dashboard';
import api from './api';

export type TodoStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TodoPriority = 1 | 2 | 3;

export interface TodoCreateInput {
  title: string;
  description?: string;
  due_date?: string;
  priority?: TodoPriority;
  status?: TodoStatus;
}

export interface TodoUpdateInput {
  title?: string;
  description?: string;
  due_date?: string;
  priority?: TodoPriority;
  status?: TodoStatus;
  is_completed?: boolean;
}

function mapBackendTodo(backend: any): Todo {
  return {
    id: backend.id,
    title: backend.title,
    description: backend.description,
    dueDate: backend.due_date,
    priority: backend.priority,
    status: backend.status,
    isCompleted: backend.is_completed,
    createdAt: backend.created_at,
  };
}

export async function getTodos(status?: TodoStatus, goalId?: string): Promise<Todo[]> {
  try {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (goalId) params.goal_id = goalId;
    const { data } = await api.get<{ items: any[] }>('/todos/', { params });
    return data.items.map(mapBackendTodo);
  } catch (error) {
    console.error('Failed to fetch todos:', error);
    return [];
  }
}

export async function createTodo(data: TodoCreateInput, goalId?: string): Promise<Todo | null> {
  try {
    const payload: Record<string, unknown> = {
      title: data.title,
      description: data.description,
      due_date: data.due_date,
      priority: data.priority ?? 2,
      status: data.status ?? 'todo',
    };
    if (goalId) payload.goal_id = goalId;
    const { data: resp } = await api.post('/todos/', payload);
    return mapBackendTodo(resp);
  } catch (error) {
    console.error('Failed to create todo:', error);
    return null;
  }
}

export async function updateTodo(id: string, data: TodoUpdateInput): Promise<Todo | null> {
  try {
    const payload: Record<string, unknown> = {};
    if (data.title !== undefined) payload.title = data.title;
    if (data.description !== undefined) payload.description = data.description;
    if (data.due_date !== undefined) payload.due_date = data.due_date;
    if (data.priority !== undefined) payload.priority = data.priority;
    if (data.status !== undefined) payload.status = data.status;
    if (data.is_completed !== undefined) payload.is_completed = data.is_completed;
    const { data: resp } = await api.patch(`/todos/${id}`, payload);
    return mapBackendTodo(resp);
  } catch (error) {
    console.error('Failed to update todo:', error);
    return null;
  }
}

export async function deleteTodo(id: string): Promise<boolean> {
  try {
    await api.delete(`/todos/${id}`);
    return true;
  } catch (error) {
    console.error('Failed to delete todo:', error);
    return false;
  }
}
