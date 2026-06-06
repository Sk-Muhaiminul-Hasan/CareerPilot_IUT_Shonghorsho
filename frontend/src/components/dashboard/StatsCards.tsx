import Grid from '@mui/material/Grid';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StarOutlineIcon from '@mui/icons-material/StarOutline';

import KpiCard from './KpiCard';
import type { DashboardStats } from '@/types/analytics';

interface StatsCardsProps {
  stats: DashboardStats | undefined;
  loading?: boolean;
}

function StatsCards({ stats, loading = false }: StatsCardsProps) {
  const jobsFound = stats?.total_jobs_found ?? 0;
  const applications = stats?.total_applications ?? 0;
  const interviews = stats?.applications_interview ?? 0;
  const atsScore = stats ? Math.round((stats.avg_ats_score ?? 0) * 100) : 0;

  return (
    <Grid container spacing={2.5}>
      {/* Jobs Found */}
      <Grid item xs={12} sm={6} lg={3}>
        <KpiCard
          label="Jobs Found"
          value={loading ? '—' : jobsFound.toLocaleString()}
          subText="Updated today"
          subTextColor="#004ac6"
          icon={<WorkOutlineIcon />}
          iconBgColor="#dbe1ff"
          iconColor="#004ac6"
          loading={loading}
        />
      </Grid>

      {/* Applications */}
      <Grid item xs={12} sm={6} lg={3}>
        <KpiCard
          label="Applications"
          value={loading ? '—' : applications.toLocaleString()}
          subText={applications > 0 ? '+12% vs last wk' : 'No data yet'}
          subTextColor="#712ae2"
          icon={<PlayCircleOutlineIcon />}
          iconBgColor="#eaddff"
          iconColor="#712ae2"
          loading={loading}
        />
      </Grid>

      {/* Interviews */}
      <Grid item xs={12} sm={6} lg={3}>
        <KpiCard
          label="Interviews"
          value={loading ? '—' : String(interviews).padStart(2, '0')}
          subText={interviews > 0 ? `${interviews} this week` : 'None yet'}
          subTextColor="#bc4800"
          icon={<TrendingUpIcon />}
          iconBgColor="#ffdbcd"
          iconColor="#943700"
          loading={loading}
        />
      </Grid>

      {/* Avg ATS Score */}
      <Grid item xs={12} sm={6} lg={3}>
        <KpiCard
          label="Avg ATS Score"
          value={loading ? '—' : `${atsScore}%`}
          subText="Top 5% of users"
          subTextColor="#434655"
          icon={<StarOutlineIcon />}
          iconBgColor="#e5eeff"
          iconColor="#004ac6"
          loading={loading}
        />
      </Grid>
    </Grid>
  );
}

export default StatsCards;
