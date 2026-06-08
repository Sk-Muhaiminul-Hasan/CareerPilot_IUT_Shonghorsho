import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as settingsService from '@/services/settingsService';

const SETTINGS_KEY = ['settings'] as const;

/** Fetch current user settings. */
export function useSettings() {
  return useQuery({
    queryKey: [...SETTINGS_KEY, 'current'],
    queryFn: () => settingsService.getSettings(),
  });
}

/** Update user settings. */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: Parameters<typeof settingsService.updateSettings>[0]) =>
      settingsService.updateSettings(update),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...SETTINGS_KEY, 'onboarding'] });
    },
  });
}

/** Fetch LLM provider statuses. */
export function useLLMProviders() {
  return useQuery({
    queryKey: [...SETTINGS_KEY, 'llm-providers'],
    queryFn: () => settingsService.getLLMProviders(),
  });
}

/** Fetch onboarding status. */
export function useOnboardingStatus() {
  return useQuery({
    queryKey: [...SETTINGS_KEY, 'onboarding'],
    queryFn: () => settingsService.getOnboardingStatus(),
  });
}

/** Update plan (premium). */
export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isPremium: boolean) => settingsService.updatePlan(isPremium),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...SETTINGS_KEY, 'onboarding'] });
    },
  });
}

/** Mark onboarding as complete. */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => settingsService.completeOnboarding(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
  });
}
