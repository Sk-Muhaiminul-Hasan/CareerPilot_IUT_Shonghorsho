import api from './api';
import type { NudgeResponse } from '@/types/nudge';

export async function getNudge(): Promise<NudgeResponse> {
  const { data } = await api.get<NudgeResponse>('/nudge');
  return data;
}
