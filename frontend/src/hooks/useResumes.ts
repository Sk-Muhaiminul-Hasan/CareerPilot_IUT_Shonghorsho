import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as resumeService from '@/services/resumeService';
import type { ResumeGenerateRequest } from '@/types/resume';

const RESUMES_KEY = ['resumes'] as const;

/** Fetch all resumes. */
export function useResumes() {
  return useQuery({
    queryKey: [...RESUMES_KEY, 'list'],
    queryFn: () => resumeService.listResumes(),
  });
}

/** Fetch only user-uploaded base resumes. */
export function useUploadedResumes() {
  return useQuery({
    queryKey: [...RESUMES_KEY, 'uploaded'],
    queryFn: () => resumeService.listUploadedResumes(),
  });
}

/** Fetch only tailored resumes. */
export function useTailoredResumes() {
  return useQuery({
    queryKey: [...RESUMES_KEY, 'tailored'],
    queryFn: () => resumeService.listTailoredResumes(),
  });
}

/** Delete a resume by ID. */
export function useDeleteResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resumeId: string) => resumeService.deleteResume(resumeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RESUMES_KEY });
    },
  });
}

/** Fetch parsed text for one resume. */
export function useResumeContent(resumeId: string | null) {
  return useQuery({
    queryKey: [...RESUMES_KEY, 'content', resumeId],
    queryFn: () => resumeService.getResumeContent(resumeId ?? ''),
    enabled: Boolean(resumeId),
  });
}

/** Upload a resume file. */
export function useUploadResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => resumeService.uploadResume(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RESUMES_KEY });
    },
  });
}

/** Generate a tailored resume. */
export function useGenerateResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ResumeGenerateRequest) => resumeService.generateResume(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RESUMES_KEY });
    },
  });
}

/** Score a resume against a job. */
export function useScoreResume() {
  return useMutation({
    mutationFn: ({ resumeId, jobId }: { resumeId: string; jobId: string }) =>
      resumeService.scoreResume(resumeId, jobId),
  });
}

/** Optimize a resume for ATS. */
export function useOptimizeResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resumeId: string) => resumeService.optimizeResume(resumeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RESUMES_KEY });
    },
  });
}

/** Update parsed resume text. */
export function useUpdateResumeContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resumeId, contentText }: { resumeId: string; contentText: string }) =>
      resumeService.updateResumeContent(resumeId, { content_text: contentText }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: RESUMES_KEY });
      void queryClient.invalidateQueries({ queryKey: [...RESUMES_KEY, 'content', data.resume_id] });
    },
  });
}

/** Create a new resume version from text. */
export function useCreateResumeFromText() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: {
      name: string;
      type?: string;
      template_id?: string;
      content_text: string;
    }) => resumeService.createResumeFromText(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RESUMES_KEY });
    },
  });
}

/** Fetch raw resume text and metadata. */
export function useResumeRaw(resumeId: string | null) {
  return useQuery({
    queryKey: [...RESUMES_KEY, 'raw', resumeId],
    queryFn: () => resumeService.getResumeRaw(resumeId ?? ''),
    enabled: Boolean(resumeId),
  });
}

/** Update raw resume text. */
export function useUpdateResumeRaw() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resumeId, rawText }: { resumeId: string; rawText: string }) =>
      resumeService.updateResumeRaw(resumeId, rawText),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: RESUMES_KEY });
      void queryClient.invalidateQueries({ queryKey: [...RESUMES_KEY, 'raw', data.id] });
    },
  });
}

