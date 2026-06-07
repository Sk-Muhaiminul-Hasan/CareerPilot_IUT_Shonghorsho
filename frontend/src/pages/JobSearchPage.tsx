import { useCallback, useRef, useState } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Pagination from '@mui/material/Pagination';
import Alert from '@mui/material/Alert';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate } from 'react-router-dom';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { useSharedWebSocket } from '@/contexts/SharedWebSocketProvider';

import JobFilters from '@/components/jobs/JobFilters';
import JobCard from '@/components/jobs/JobCard';
import JobDetail from '@/components/jobs/JobDetail';
import ApplyModal from '@/components/jobs/ApplyModal';
import LoadingState from '@/components/common/LoadingState';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { useJobs, useSearchJobs } from '@/hooks/useJobs';
import { useCreateApplication } from '@/hooks/useApplications';
import { useJobStore } from '@/store/useJobStore';
import { useAppStore } from '@/store/useAppStore';
import * as jobService from '@/services/jobService';
import type { Job } from '@/types/job';

function JobSearchPage() {
  const [page, setPage] = useState(1);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const enrichmentCountRef = useRef(0);
  const totalEnrichJobsRef = useRef(0);
  const navigate = useNavigate();
  const searchQuery = useJobStore((s) => s.searchQuery);
  const locationFilter = useJobStore((s) => s.locationFilter);
  const platformFilters = useJobStore((s) => s.platformFilters);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const detailOpen = useJobStore((s) => s.detailOpen);
  const openDetail = useJobStore((s) => s.openDetail);
  const closeDetail = useJobStore((s) => s.closeDetail);
  const showNotification = useAppStore((s) => s.showNotification);
  const clearNotification = useAppStore((s) => s.clearNotification);
  const { onJobEnriched } = useSharedWebSocket();
  const queryClient = useQueryClient();

  const { data: jobsData, isLoading, isError } = useJobs(page, 20);
  const searchMutation = useSearchJobs();
  const createAppMutation = useCreateApplication();

  onJobEnriched(
    useCallback(
      async ({ job_id }: { job_id: string }) => {
        enrichmentCountRef.current += 1;

        if (totalEnrichJobsRef.current > 0) {
          showNotification(
            `🔍 Enriching jobs... (${enrichmentCountRef.current}/${totalEnrichJobsRef.current} complete)`,
            'info',
            null,
          );

          if (enrichmentCountRef.current >= totalEnrichJobsRef.current) {
            showNotification('🎉 All job details fetched!', 'success');
            enrichmentCountRef.current = 0;
            totalEnrichJobsRef.current = 0;
          }
        }

        try {
          const updatedJob = (await jobService.getJob(job_id)) as Job;
          queryClient.setQueryData<Job>(['jobs', 'detail', job_id], updatedJob);
          queryClient.setQueriesData<{ items: Job[] }>({ queryKey: ['jobs', 'list'] }, (old) => {
            if (!old) {
              return old;
            }
            return {
              ...old,
              items: old.items.map((job) => (job.id === job_id ? updatedJob : job)),
            };
          });
        } catch {
          // Ignore single refresh failures; the list will recover on next fetch.
        }
      },
      [queryClient, showNotification],
    ),
  );

  const handleApplyClick = useCallback((jobId: string) => {
    setPendingJobId(jobId);
  }, []);

  const handleApplyConfirm = useCallback(
    (applyMode: string, resumeId: string) => {
      if (!pendingJobId) return;
      const job = jobsData?.items.find((j) => j.id === pendingJobId);

      if (applyMode === 'manual') {
        createAppMutation.mutate(
          { job_id: pendingJobId, apply_mode: 'manual', resume_id: resumeId },
          {
            onSuccess: () => {
              showNotification('Application recorded. Opening job page...', 'success');
              setPendingJobId(null);
              if (job?.url) {
                window.open(job.url, '_blank');
              }
            },
            onError: () => {
              showNotification('Failed to create application.', 'error');
            },
          },
        );
        return;
      }

      createAppMutation.mutate(
        { job_id: pendingJobId, apply_mode: applyMode, resume_id: resumeId },
        {
          onSuccess: (data) => {
            showNotification('Application created successfully.', 'success');
            setPendingJobId(null);
            navigate(`/applications/${(data as { id?: string } | undefined)?.id}`);
          },
          onError: () => {
            showNotification('Failed to create application.', 'error');
          },
        },
      );
    },
    [pendingJobId, createAppMutation, showNotification, navigate, jobsData],
  );

  const handleApplyClose = useCallback(() => {
    setPendingJobId(null);
  }, []);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;

    enrichmentCountRef.current = 0;
    totalEnrichJobsRef.current = 0;

    showNotification(
      '🤖 Job hunter agent is actively searching for you. We\'ll notify you when results are ready!',
      'info',
      null,
    );

    searchMutation.mutate(
      {
        query: searchQuery,
        location: locationFilter || undefined,
        platforms: platformFilters,
        limit: 20,
      },
      {
        onSuccess: (result) => {
          clearNotification();
          totalEnrichJobsRef.current = result.total;
          showNotification(
            `✅ Found ${result.total} jobs! Job crawler is now fetching full details one by one...`,
            'info',
            null,
          );
        },
        onError: () => {
          showNotification('Job search failed. Please try again.', 'error');
        },
      },
    );
  }, [searchQuery, locationFilter, platformFilters, searchMutation, showNotification, clearNotification]);

  const handlePageChange = useCallback((_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  }, []);

  return (
    <ErrorBoundary>
      <Box>
        <Typography variant="h4" gutterBottom>
          Job Search
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Search across LinkedIn, Indeed, and Glassdoor
        </Typography>

        <JobFilters onSearch={handleSearch} loading={searchMutation.isPending} />

        {isLoading && <LoadingState message="Loading jobs..." />}

        {isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load jobs. Please check your connection and try again.
          </Alert>
        )}

        {!isLoading && !isError && jobsData && jobsData.items.length === 0 && (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
            }}
          >
            <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No jobs found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try searching for a job title or keyword above.
            </Typography>
          </Box>
        )}

        {jobsData && jobsData.items.length > 0 && (
          <>
            <Grid container spacing={2}>
              {jobsData.items.map((job) => (
                <Grid item xs={12} sm={6} lg={4} key={job.id}>
                  <JobCard
                    job={job}
                    onViewDetails={openDetail}
                    onApply={handleApplyClick}
                  />
                </Grid>
              ))}
            </Grid>

            {jobsData.total > 20 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Pagination
                  count={Math.ceil(jobsData.total / 20)}
                  page={page}
                  onChange={handlePageChange}
                  color="primary"
                />
              </Box>
            )}
          </>
        )}

        <JobDetail
          jobId={selectedJobId}
          open={detailOpen}
          onClose={closeDetail}
          onApply={handleApplyClick}
        />

        {pendingJobId && (
          <ApplyModal
            open={!!pendingJobId}
            jobTitle={jobsData?.items.find((j) => j.id === pendingJobId)?.title ?? 'Job'}
            company={jobsData?.items.find((j) => j.id === pendingJobId)?.company ?? ''}
            jobUrl={jobsData?.items.find((j) => j.id === pendingJobId)?.url ?? ''}
            onClose={handleApplyClose}
            onConfirm={handleApplyConfirm}
          />
        )}
      </Box>
    </ErrorBoundary>
  );
}

export default JobSearchPage;
