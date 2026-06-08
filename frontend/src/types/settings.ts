export interface WorkExperience {
  title: string;
  company: string;
  start_date: string;
  end_date: string;
  description: string;
  responsibilities: string[];
}

export interface Education {
  degree: string;
  institution: string;
  graduation_year: string;
  gpa?: string;
}

export interface CandidateProfile {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin_url: string;
  github_url: string;
  summary: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  certifications: string[];
  projects?: string[];
}

export interface Settings {
  apply_mode: string;
  min_ats_score: number;
  max_parallel: number;
  general_provider: string | null;
  general_model: string | null;
  general_api_key: string | null;
  extraction_provider: string | null;
  extraction_model: string | null;
  extraction_api_key: string | null;
  onboarding_complete: boolean;
  is_premium: boolean;
  platforms_enabled: string[];
  candidate_profile: CandidateProfile;
}

export type SettingsResponse = Settings;

export interface SettingsUpdate {
  apply_mode?: string;
  min_ats_score?: number;
  max_parallel?: number;
  general_provider?: string | null;
  general_model?: string | null;
  general_api_key?: string | null;
  extraction_provider?: string | null;
  extraction_model?: string | null;
  extraction_api_key?: string | null;
  onboarding_complete?: boolean;
  is_premium?: boolean;
  platforms_enabled?: string[];
  candidate_profile?: CandidateProfile;
}

export interface LLMProviderStatus {
  provider: string;
  configured: boolean;
  model: string;
  is_primary: boolean;
}

export interface OnboardingStatus {
  onboarding_complete: boolean;
  has_general_ai: boolean;
  has_extraction_ai: boolean;
  has_resume: boolean;
}
