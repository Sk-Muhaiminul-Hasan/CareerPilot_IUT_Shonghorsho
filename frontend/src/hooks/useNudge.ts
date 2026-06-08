import { useQuery } from '@tanstack/react-query';
import * as nudgeService from '@/services/nudgeService';
import type { ApiError } from '@/types/api';

const NUDGE_KEY = ['nudge'] as const;

export function useNudge() {
  return useQuery({
    queryKey: NUDGE_KEY,
    queryFn: nudgeService.getNudge,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useNudgeAIError(error: ApiError | null | undefined): boolean {
  if (!error || !error.detail) return false;
  try {
    const detail = JSON.parse(error.detail);
    return error.status_code === 428 && detail.code === 'ai_not_configured';
  } catch {
    return false;
  }
}
