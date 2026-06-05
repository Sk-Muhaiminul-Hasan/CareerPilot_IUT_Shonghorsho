import type { Job } from './job';

export interface NudgeResponse {
  headline: string;
  bullets: string[];
  type: 'active' | 'inactive';
  applications_this_week: number;
  recommended_jobs: Job[];
}
