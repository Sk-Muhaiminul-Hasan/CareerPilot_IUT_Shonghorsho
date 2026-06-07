export interface JobEnrichedMessage {
  type: 'job_enriched';
  job_id: string;
  title: string;
}

export type WSMessage =
  | {
      type: 'application_progress';
      application_id: string;
      status: string;
      detail?: string;
    }
  | {
      type: 'application_complete';
      application_id: string;
      status: string;
    }
  | {
      type: 'application_scored';
      application_id: string;
      ats_score: number | null;
      reasoning: unknown;
    }
  | JobEnrichedMessage;
