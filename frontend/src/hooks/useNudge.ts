import { useQuery } from '@tanstack/react-query';
import * as nudgeService from '@/services/nudgeService';

const NUDGE_KEY = ['nudge'] as const;

export function useNudge() {
  return useQuery({
    queryKey: NUDGE_KEY,
    queryFn: nudgeService.getNudge,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
}
