import type { ChatAttachment } from '@/types/chat';

export type ContextAction = 'job_description' | 'benchmark_prompt';

export interface ContextOption {
  id: string;
  label: string;
  description: string;
  insertText: string;
  attachment?: ChatAttachment;
  action?: ContextAction;
  disabled?: boolean;
}

interface ContextOptionInput {
  activeJobId: string | null;
  userProfileId: string | null;
  screenPath: string;
}

export function screenLabel(path: string): string {
  if (path.startsWith('/resumes')) return 'Resume workspace';
  if (path.startsWith('/jobs')) return 'Job search';
  if (path.startsWith('/applications')) return 'Applications tracker';
  if (path.startsWith('/artifacts')) return 'Artifacts';
  if (path.startsWith('/analytics')) return 'Analytics';
  if (path.startsWith('/settings')) return 'Settings';
  return 'Dashboard';
}

export function buildContextOptions({
  activeJobId,
  userProfileId,
  screenPath,
}: ContextOptionInput): ContextOption[] {
  const currentScreen = screenLabel(screenPath);

  return [
    {
      id: 'current-screen',
      label: `Current screen: ${currentScreen}`,
      description: 'Attach the page and workflow you are looking at right now.',
      insertText: 'current screen',
      attachment: {
        type: 'screen',
        label: currentScreen,
        value: `The user is currently on ${currentScreen} at ${screenPath}.`,
      },
    },
    {
      id: 'active-cv',
      label: 'Latest CV',
      description: 'Use the latest uploaded CV.',
      insertText: 'Latest CV',
      attachment: {
        type: 'resume',
        label: 'Latest CV',
        value: userProfileId || 'default_user',
      },
    },
    {
      id: 'current-job',
      label: 'Current job',
      description: activeJobId ? 'Attach the open job card or saved role.' : 'Available when a job is selected.',
      insertText: 'current job',
      disabled: !activeJobId,
      attachment: activeJobId
        ? {
            type: 'job',
            label: 'Current job',
            value: activeJobId,
          }
        : undefined,
    },
    {
      id: 'job-description',
      label: 'Job description',
      description: 'Paste a posting for readiness checks or cover letters.',
      insertText: 'job description',
      action: 'job_description',
    },
    {
      id: 'benchmark-analyser',
      label: 'Benchmark analyser',
      description: 'Tell Copilot the company, role, or profile you want to compare against.',
      insertText: 'benchmark analyser',
      action: 'benchmark_prompt',
    },
  ];
}
