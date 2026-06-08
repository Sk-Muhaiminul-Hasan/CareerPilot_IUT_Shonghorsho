import api from './api';
import type {
  Resume,
  ResumeUploadResponse,
  ResumeScoreResponse,
  ResumeGenerateRequest,
  ResumeListResponse,
  ResumeContent,
  ResumeContentUpdate,
  ResumeRawResponse,
} from '@/types/resume';


/** Authenticated download of a resume as PDF or DOCX. */
export async function downloadResume(
  resumeId: string,
  format: 'pdf' | 'docx',
): Promise<void> {
  try {
    const response = await api.get(
      `/resumes/${resumeId}/download?format=${format}`,
      { responseType: 'blob' },
    );
    const filename =
      getFilenameFromContentDisposition(response.headers['content-disposition']) ??
      `resume.${format}`;
    triggerBrowserDownload(response.data, filename);
  } catch (error) {
    if (format === 'pdf') {
      try {
        const response = await api.get(
          `/resumes/${resumeId}/download?format=docx`,
          { responseType: 'blob' },
        );
        const filename =
          getFilenameFromContentDisposition(response.headers['content-disposition']) ??
          'resume.docx';
        triggerBrowserDownload(response.data, filename);
        return;
      } catch {
        // docx also failed, surface the original error
      }
    }
    console.error('Failed to download resume:', error);
    throw error;
  }
}

function getFilenameFromContentDisposition(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/filename\*?=['"]?([^'";]+)['"]?/i);
  if (match?.[1]) return decodeURIComponent(match[1]);
  const simpleMatch = header.match(/filename=['"]?([^'";]+)['"]?/i);
  return simpleMatch?.[1] ?? null;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** List all uploaded and generated resumes. */
export async function listResumes(): Promise<ResumeListResponse> {
  const { data } = await api.get<ResumeListResponse>('/resumes/');
  return data;
}

/** Upload a raw resume file. */
export async function uploadResume(file: File): Promise<ResumeUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<ResumeUploadResponse>('/resumes/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/** Generate a job-tailored resume from a base resume. */
export async function generateResume(request: ResumeGenerateRequest): Promise<Resume> {
  const { data } = await api.post<Resume>('/resumes/generate', request);
  return data;
}

/** Trigger LLM re-extraction for an already-uploaded resume. */
export async function reextractResume(resumeId: string): Promise<{ status: string; text_length: number }> {
  const { data } = await api.post(`/resumes/${resumeId}/reextract`);
  return data;
}

/** Score a resume's ATS compatibility against a specific job. */
export async function scoreResume(
  resumeId: string,
  jobId: string,
): Promise<ResumeScoreResponse> {
  const { data } = await api.post<ResumeScoreResponse>(`/resumes/${resumeId}/score`, {
    job_id: jobId,
  });
  return data;
}

/** Optimize a resume for ATS keyword matching. */
export async function optimizeResume(resumeId: string): Promise<Resume> {

  const { data } = await api.post<Resume>(`/resumes/${resumeId}/optimize`);
  return data;
}

/** Get parsed resume text for simple review/editing. */
export async function getResumeContent(resumeId: string): Promise<ResumeContent> {
  const { data } = await api.get<ResumeContent>(`/resumes/${resumeId}/content`);
  return data;
}

/** Update parsed resume text. */
export async function updateResumeContent(
  resumeId: string,
      request: ResumeContentUpdate,
    ): Promise<ResumeContent> {
      const { data } = await api.patch<ResumeContent>(`/resumes/${resumeId}/content`, request);
      return data;
    }

/** Get the download URL for a resume file. */
export function getDownloadUrl(resumeId: string, format: 'pdf' | 'docx' = 'pdf'): string {
      const baseURL = api.defaults.baseURL ?? '/api/v1';
      return `${baseURL}/resumes/${resumeId}/download?format=${format}`;
    }

/** List only user-uploaded base resumes. */
export async function listUploadedResumes(): Promise<ResumeListResponse> {
  const { data } = await api.get<ResumeListResponse>('/resumes/uploaded');
  return data;
}

/** List only AI-generated tailored resumes. */
export async function listTailoredResumes(): Promise<ResumeListResponse> {
  const { data } = await api.get<ResumeListResponse>('/resumes/tailored');
  return data;
}

/** Delete a resume. */
export async function deleteResume(resumeId: string): Promise<{ status: string; message: string }> {
  const { data } = await api.delete<{ status: string; message: string }>(`/resumes/${resumeId}`);
  return data;
}

/** Create a new resume version from text. */
export async function createResumeFromText(request: {
  name: string;
  type?: string;
  template_id?: string;
  content_text: string;
}): Promise<Resume> {
  const { data } = await api.post<Resume>('/resumes/', request);
  return data;
}

/** Get the raw text representation of a resume. */
export async function getResumeRaw(resumeId: string): Promise<ResumeRawResponse> {
  const { data } = await api.get<ResumeRawResponse>(`/resumes/${resumeId}/raw`);
  return data;
}

/** Update the raw text of a resume. */
export async function updateResumeRaw(
  resumeId: string,
  rawText: string,
): Promise<ResumeRawResponse> {
  const { data } = await api.put<ResumeRawResponse>(`/resumes/${resumeId}/raw`, {
    raw_text: rawText,
  });
  return data;
}

