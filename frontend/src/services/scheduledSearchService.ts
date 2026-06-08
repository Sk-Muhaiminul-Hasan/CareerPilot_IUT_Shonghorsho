import api from './api';
import type { ScheduledSearch, ScheduledSearchCreate, ScheduledSearchUpdate } from '@/types/scheduledSearch';

export async function listScheduledSearches(): Promise<ScheduledSearch[]> {
  const { data } = await api.get<ScheduledSearch[]>('/scheduled-searches/');
  return data;
}

export async function createScheduledSearch(
  payload: ScheduledSearchCreate,
): Promise<ScheduledSearch> {
  const { data } = await api.post<ScheduledSearch>('/scheduled-searches/', payload);
  return data;
}

export async function updateScheduledSearch(
  searchId: string,
  payload: ScheduledSearchUpdate,
): Promise<ScheduledSearch> {
  const { data } = await api.patch<ScheduledSearch>(`/scheduled-searches/${searchId}`, payload);
  return data;
}

export async function deleteScheduledSearch(searchId: string): Promise<void> {
  await api.delete(`/scheduled-searches/${searchId}`);
}
