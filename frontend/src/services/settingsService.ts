import api from './api';
import type { Settings, SettingsUpdate, OnboardingStatus, LLMProviderStatus } from '@/types/settings';

/** Get the current user settings. */
export async function getSettings(): Promise<Settings> {
  const { data } = await api.get<Settings>('/settings/');
  return data;
}

/** Update user settings. Only provided fields are changed. */
export async function updateSettings(update: SettingsUpdate): Promise<Settings> {
  const { data } = await api.put<Settings>('/settings/', update);
  return data;
}

/** Update plan (premium). */
export async function updatePlan(isPremium: boolean): Promise<Settings> {
  const { data } = await api.patch<Settings>('/settings/plan', { is_premium: isPremium });
  return data;
}

/** List configured LLM providers and their status. */
export async function getLLMProviders(): Promise<LLMProviderStatus[]> {
  const { data } = await api.get<LLMProviderStatus[]>('/settings/llm-providers');
  return data;
}

/** Get onboarding status for the current user. */
export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const { data } = await api.get<OnboardingStatus>('/onboarding/status');
  return data;
}

/** Mark onboarding as complete. */
export async function completeOnboarding(): Promise<void> {
  await api.post('/onboarding/complete');
}
