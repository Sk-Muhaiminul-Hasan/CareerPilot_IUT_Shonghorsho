import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WorkIcon from '@mui/icons-material/Work';
import DescriptionIcon from '@mui/icons-material/Description';
import BarChartIcon from '@mui/icons-material/BarChart';
import SmartToyIcon from '@mui/icons-material/SmartToy';

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  root: {
    minHeight: '100vh',
    background: '#f9f9ff',
    fontFamily: '"Hanken Grotesk", "Inter", sans-serif',
    overflowX: 'hidden' as const,
  },
  nav: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    background: 'rgba(249,249,255,0.85)',
    borderBottom: '1px solid rgba(195,198,214,0.4)',
    transition: 'all 0.3s ease',
  },
  navInner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 2rem',
    height: 72,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    textDecoration: 'none',
  },
  logoImg: {
    width: 40,
    height: 40,
    objectFit: 'contain' as const,
  },
  logoText: {
    fontFamily: '"Hanken Grotesk", sans-serif',
    fontWeight: 800,
    fontSize: '1.25rem',
    color: '#003d9b',
    letterSpacing: '-0.02em',
  },
  navActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
};

// ─── Feature Card ──────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  delay: number;
}

function FeatureCard({ icon, title, description, color, delay }: FeatureCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Box
      sx={{
        background: '#ffffff',
        border: '1px solid #e1e8fd',
        borderRadius: '16px',
        padding: '1.5rem',
        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        cursor: 'default',
        '&:hover': {
          boxShadow: '0 12px 40px rgba(0, 61, 155, 0.12)',
          transform: 'translateY(-4px)',
          borderColor: '#b2c5ff',
        },
      }}
    >
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: '14px',
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
          color: '#003d9b',
        }}
      >
        {icon}
      </Box>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 700,
          color: '#141b2b',
          mb: 0.75,
          fontSize: '1rem',
        }}
      >
        {title}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: '#434654', lineHeight: 1.6 }}
      >
        {description}
      </Typography>
    </Box>
  );
}

// ─── Stat Pill ─────────────────────────────────────────────────────────────────

interface StatPillProps {
  value: string;
  label: string;
  delay: number;
}

function StatPill({ value, label, delay }: StatPillProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Box
      sx={{
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(195,198,214,0.5)',
        borderRadius: '12px',
        padding: '0.875rem 1.25rem',
        textAlign: 'center',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.9)',
        transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        minWidth: 120,
      }}
    >
      <Typography
        sx={{
          fontFamily: '"Hanken Grotesk", sans-serif',
          fontWeight: 800,
          fontSize: '1.75rem',
          color: '#003d9b',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          mb: 0.25,
        }}
      >
        {value}
      </Typography>
      <Typography
        sx={{
          fontFamily: '"Hanken Grotesk", sans-serif',
          fontSize: '0.7rem',
          fontWeight: 700,
          color: '#737685',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

function HomePage() {
  const navigate = useNavigate();
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setHeroVisible(true), 100);
  }, []);

  const features = [
    {
      icon: <RocketLaunchIcon />,
      title: 'AI Auto-Apply',
      description:
        'Let Auto handle the applications. Our AI fills and submits job forms on your behalf, saving you hours every week.',
      color: 'rgba(0, 61, 155, 0.08)',
      delay: 400,
    },
    {
      icon: <WorkIcon />,
      title: 'Smart Job Discovery',
      description:
        'Search across thousands of jobs in real-time. Filter by role, location, salary, and remote options instantly.',
      color: 'rgba(0, 82, 204, 0.08)',
      delay: 500,
    },
    {
      icon: <DescriptionIcon />,
      title: 'Resume Intelligence',
      description:
        'Upload your resume once. Auto tailors it for each application to maximize ATS match scores and recruiter attention.',
      color: 'rgba(179, 197, 255, 0.4)',
      delay: 600,
    },
    {
      icon: <BarChartIcon />,
      title: 'Application Analytics',
      description:
        'Track every application through your pipeline. Know exactly where you stand with real-time status updates.',
      color: 'rgba(220, 226, 247, 0.8)',
      delay: 700,
    },
    {
      icon: <SmartToyIcon />,
      title: 'Career Copilot',
      description:
        'Chat with Auto anytime. Get interview prep, salary negotiation tips, and career strategy on demand.',
      color: 'rgba(0, 61, 155, 0.06)',
      delay: 800,
    },
    {
      icon: <TrendingUpIcon />,
      title: 'Success Tracking',
      description:
        'Visualize your job search momentum. Celebrate wins, identify patterns, and optimize your strategy over time.',
      color: 'rgba(196, 210, 255, 0.5)',
      delay: 900,
    },
  ];

  return (
    <Box sx={styles.root}>
      {/* ── Navigation ───────────────────────────────────────────── */}
      <Box sx={styles.nav}>
        <Box sx={styles.navInner}>
          {/* Logo */}
          <Box sx={styles.logoArea}>
            <img src="/auto-logo.png" alt="Auto" style={styles.logoImg} />
            <span style={styles.logoText}>CareerPilot</span>
          </Box>

          {/* Nav Actions */}
          <Box sx={styles.navActions}>
            <Button
              variant="text"
              onClick={() => navigate('/login')}
              sx={{
                color: '#434654',
                fontWeight: 600,
                fontSize: '0.9rem',
                '&:hover': { color: '#003d9b', background: 'rgba(0,61,155,0.05)' },
              }}
            >
              Sign In
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate('/login?tab=signup')}
              endIcon={<ArrowForwardIcon />}
              sx={{
                background: 'linear-gradient(135deg, #003d9b 0%, #0052cc 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.875rem',
                borderRadius: '10px',
                px: 2.5,
                py: 1,
                boxShadow: '0 4px 20px rgba(0, 61, 155, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #001848 0%, #003d9b 100%)',
                  boxShadow: '0 6px 28px rgba(0, 61, 155, 0.4)',
                  transform: 'translateY(-1px)',
                },
                transition: 'all 0.2s ease',
              }}
            >
              Get Started Free
            </Button>
          </Box>
        </Box>
      </Box>

      {/* ── Hero Section ─────────────────────────────────────────── */}
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          pt: '72px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background decorations */}
        <Box
          sx={{
            position: 'absolute',
            top: '-10%',
            right: '-5%',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(0, 61, 155, 0.07) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: '-5%',
            left: '-8%',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(178, 197, 255, 0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        {/* Grid dot pattern */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle, rgba(0,61,155,0.08) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            pointerEvents: 'none',
            opacity: 0.6,
          }}
        />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container spacing={6} alignItems="center" sx={{ py: { xs: 6, md: 8 } }}>
            {/* Left: Text Content */}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  opacity: heroVisible ? 1 : 0,
                  transform: heroVisible ? 'translateX(0)' : 'translateX(-40px)',
                  transition: 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                }}
              >
                <Chip
                  icon={<AutoAwesomeIcon sx={{ fontSize: '0.85rem !important' }} />}
                  label="AI-Powered Career Platform"
                  sx={{
                    mb: 3,
                    background: 'rgba(0, 61, 155, 0.08)',
                    color: '#003d9b',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    letterSpacing: '0.04em',
                    border: '1px solid rgba(0, 61, 155, 0.2)',
                    borderRadius: '999px',
                    px: 0.5,
                  }}
                />

                <Typography
                  component="h1"
                  sx={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontWeight: 800,
                    fontSize: { xs: '2.5rem', sm: '3rem', md: '3.5rem' },
                    lineHeight: 1.1,
                    letterSpacing: '-0.03em',
                    color: '#141b2b',
                    mb: 2.5,
                  }}
                >
                  Your AI co-pilot for{' '}
                  <Box
                    component="span"
                    sx={{
                      background: 'linear-gradient(135deg, #003d9b 0%, #0c56d0 60%, #4a7de8 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    landing your dream job
                  </Box>
                </Typography>

                <Typography
                  sx={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: { xs: '1rem', md: '1.125rem' },
                    color: '#434654',
                    lineHeight: 1.7,
                    mb: 4,
                    maxWidth: 480,
                  }}
                >
                  Meet <strong style={{ color: '#003d9b' }}>Auto</strong> — your personal job-search
                  superhero. Auto finds opportunities, tailors your resume, fills out applications,
                  and tracks your progress so you can focus on interview prep.
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 5 }}>
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<RocketLaunchIcon />}
                    onClick={() => navigate('/login?tab=signup')}
                    sx={{
                      background: 'linear-gradient(135deg, #003d9b 0%, #0052cc 100%)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '1rem',
                      borderRadius: '12px',
                      px: 3.5,
                      py: 1.5,
                      boxShadow: '0 6px 28px rgba(0, 61, 155, 0.35)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #001848 0%, #003d9b 100%)',
                        boxShadow: '0 8px 36px rgba(0, 61, 155, 0.45)',
                        transform: 'translateY(-2px)',
                      },
                      transition: 'all 0.25s ease',
                    }}
                  >
                    Start for Free
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => navigate('/login')}
                    sx={{
                      borderColor: '#c3c6d6',
                      color: '#141b2b',
                      fontWeight: 600,
                      fontSize: '1rem',
                      borderRadius: '12px',
                      px: 3.5,
                      py: 1.5,
                      '&:hover': {
                        borderColor: '#003d9b',
                        color: '#003d9b',
                        background: 'rgba(0, 61, 155, 0.04)',
                      },
                    }}
                  >
                    Sign In
                  </Button>
                </Box>

                {/* Stats Row */}
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <StatPill value="10x" label="Faster Apply" delay={600} />
                  <StatPill value="500+" label="Job Boards" delay={700} />
                  <StatPill value="94%" label="ATS Match Rate" delay={800} />
                </Box>
              </Box>
            </Grid>

            {/* Right: Mascot + Floating Cards */}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: { xs: 340, md: 480 },
                  opacity: heroVisible ? 1 : 0,
                  transform: heroVisible ? 'translateX(0)' : 'translateX(40px)',
                  transition: 'all 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                }}
              >
                {/* Glow circle behind mascot */}
                <Box
                  sx={{
                    position: 'absolute',
                    width: 320,
                    height: 320,
                    borderRadius: '50%',
                    background:
                      'radial-gradient(circle, rgba(0,61,155,0.12) 0%, rgba(178,197,255,0.15) 50%, transparent 75%)',
                    animation: 'pulse-glow 4s ease-in-out infinite',
                    '@keyframes pulse-glow': {
                      '0%, 100%': { transform: 'scale(1)', opacity: 0.8 },
                      '50%': { transform: 'scale(1.08)', opacity: 1 },
                    },
                  }}
                />

                {/* Main mascot */}
                <Box
                  component="img"
                  src="/auto-waving.png"
                  alt="Auto - Your AI Career Copilot"
                  sx={{
                    width: { xs: 240, md: 340 },
                    height: 'auto',
                    position: 'relative',
                    zIndex: 2,
                    filter: 'drop-shadow(0 20px 40px rgba(0, 61, 155, 0.2))',
                    animation: 'float-mascot 6s ease-in-out infinite',
                    '@keyframes float-mascot': {
                      '0%, 100%': { transform: 'translateY(0px)' },
                      '50%': { transform: 'translateY(-14px)' },
                    },
                  }}
                />

                {/* Floating card: Auto-Apply */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: { xs: 20, md: 40 },
                    left: { xs: 0, md: -20 },
                    background: '#ffffff',
                    border: '1px solid #e1e8fd',
                    borderRadius: '14px',
                    padding: '0.75rem 1rem',
                    boxShadow: '0 8px 32px rgba(0, 61, 155, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    zIndex: 3,
                    animation: 'float-card-1 5s ease-in-out infinite',
                    '@keyframes float-card-1': {
                      '0%, 100%': { transform: 'translateY(0px) rotate(-1deg)' },
                      '50%': { transform: 'translateY(-8px) rotate(0deg)' },
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      background: 'rgba(0,61,155,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CheckCircleIcon sx={{ color: '#003d9b', fontSize: '1.2rem' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#141b2b', lineHeight: 1 }}>
                      Application Sent!
                    </Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: '#737685', mt: 0.25 }}>
                      Google · Software Engineer
                    </Typography>
                  </Box>
                </Box>

                {/* Floating card: Jobs Found */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: { xs: 40, md: 60 },
                    right: { xs: 0, md: -10 },
                    background: '#003d9b',
                    borderRadius: '14px',
                    padding: '0.875rem 1.125rem',
                    boxShadow: '0 8px 32px rgba(0, 61, 155, 0.3)',
                    zIndex: 3,
                    animation: 'float-card-2 6s ease-in-out infinite 1s',
                    '@keyframes float-card-2': {
                      '0%, 100%': { transform: 'translateY(0px) rotate(1deg)' },
                      '50%': { transform: 'translateY(-10px) rotate(0deg)' },
                    },
                  }}
                >
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(196,210,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>
                    Today's Matches
                  </Typography>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>
                    47 Jobs
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'rgba(178,197,255,0.8)', mt: 0.25 }}>
                    🔥 Best match rate this week
                  </Typography>
                </Box>

                {/* Floating card: Resume Score */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: { xs: 'auto', md: '55%' },
                    bottom: { xs: 150, md: 'auto' },
                    left: { xs: 20, md: -30 },
                    background: '#ffffff',
                    border: '1px solid #e1e8fd',
                    borderRadius: '14px',
                    padding: '0.75rem 1rem',
                    boxShadow: '0 8px 32px rgba(0, 61, 155, 0.1)',
                    zIndex: 3,
                    animation: 'float-card-3 7s ease-in-out infinite 0.5s',
                    '@keyframes float-card-3': {
                      '0%, 100%': { transform: 'translateY(0px)' },
                      '50%': { transform: 'translateY(-6px)' },
                    },
                  }}
                >
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#737685', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                    Resume ATS Score
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#003d9b', lineHeight: 1 }}>
                      94%
                    </Typography>
                    <Chip
                      label="Excellent"
                      size="small"
                      sx={{
                        background: 'rgba(0, 150, 80, 0.1)',
                        color: '#00612f',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        height: 20,
                        borderRadius: '6px',
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ── Features Section ─────────────────────────────────────── */}
      <Box
        sx={{
          py: { xs: 8, md: 12 },
          background: 'linear-gradient(180deg, #f9f9ff 0%, #f1f3ff 100%)',
          position: 'relative',
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 8 } }}>
            <Chip
              label="EVERYTHING YOU NEED"
              sx={{
                mb: 2,
                background: 'rgba(0, 61, 155, 0.08)',
                color: '#003d9b',
                fontWeight: 700,
                fontSize: '0.7rem',
                letterSpacing: '0.06em',
                border: '1px solid rgba(0, 61, 155, 0.15)',
                borderRadius: '999px',
              }}
            />
            <Typography
              component="h2"
              sx={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontWeight: 800,
                fontSize: { xs: '2rem', md: '2.75rem' },
                letterSpacing: '-0.02em',
                color: '#141b2b',
                mb: 2,
                lineHeight: 1.15,
              }}
            >
              One platform, zero job-search stress
            </Typography>
            <Typography
              sx={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '1.1rem',
                color: '#434654',
                maxWidth: 520,
                mx: 'auto',
                lineHeight: 1.65,
              }}
            >
              CareerPilot handles every step of your job search — so you can focus on
              what really matters: getting hired.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {features.map((feature) => (
              <Grid item xs={12} sm={6} md={4} key={feature.title}>
                <FeatureCard
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  color={feature.color}
                  delay={feature.delay}
                />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── How It Works ─────────────────────────────────────────── */}
      <Box sx={{ py: { xs: 8, md: 12 }, background: '#ffffff' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 8 } }}>
            <Chip
              label="HOW IT WORKS"
              sx={{
                mb: 2,
                background: 'rgba(0, 61, 155, 0.08)',
                color: '#003d9b',
                fontWeight: 700,
                fontSize: '0.7rem',
                letterSpacing: '0.06em',
                border: '1px solid rgba(0, 61, 155, 0.15)',
                borderRadius: '999px',
              }}
            />
            <Typography
              component="h2"
              sx={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontWeight: 800,
                fontSize: { xs: '2rem', md: '2.75rem' },
                letterSpacing: '-0.02em',
                color: '#141b2b',
                mb: 2,
              }}
            >
              Get hired in 3 simple steps
            </Typography>
          </Box>

          <Grid container spacing={4} alignItems="center">
            {[
              {
                step: '01',
                title: 'Upload Your Resume',
                body: 'Drop your resume and let Auto analyze your skills, experience, and career goals to build your career profile.',
                img: '/auto-laptop.png',
              },
              {
                step: '02',
                title: 'Auto Finds & Applies',
                body: "Set your job preferences and watch Auto go to work. It searches, matches, and submits applications — all while you sleep.",
                img: '/auto-waving.png',
              },
              {
                step: '03',
                title: 'Track & Get Hired',
                body: 'Monitor every application in your dashboard, prepare for interviews with AI coaching, and land your dream role.',
                img: '/auto-thumbsup.png',
              },
            ].map((step, idx) => (
              <Grid item xs={12} md={4} key={step.step}>
                <Box
                  sx={{
                    textAlign: 'center',
                    px: 2,
                    position: 'relative',
                  }}
                >
                  {/* Step number */}
                  <Typography
                    sx={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontWeight: 800,
                      fontSize: '4rem',
                      color: 'rgba(0, 61, 155, 0.06)',
                      lineHeight: 1,
                      mb: -2,
                      letterSpacing: '-0.05em',
                    }}
                  >
                    {step.step}
                  </Typography>
                  <Box
                    component="img"
                    src={step.img}
                    alt={step.title}
                    sx={{
                      width: 160,
                      height: 'auto',
                      mb: 2,
                      filter: 'drop-shadow(0 8px 20px rgba(0,61,155,0.15))',
                      animation: `float-step-${idx} ${5 + idx}s ease-in-out infinite ${idx * 0.5}s`,
                      [`@keyframes float-step-${idx}`]: {
                        '0%, 100%': { transform: 'translateY(0)' },
                        '50%': { transform: 'translateY(-10px)' },
                      },
                    }}
                  />
                  <Typography
                    sx={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontWeight: 700,
                      fontSize: '1.15rem',
                      color: '#141b2b',
                      mb: 1,
                    }}
                  >
                    {step.title}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '0.9rem',
                      color: '#434654',
                      lineHeight: 1.65,
                    }}
                  >
                    {step.body}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── CTA Banner ───────────────────────────────────────────── */}
      <Box
        sx={{
          py: { xs: 8, md: 10 },
          background: 'linear-gradient(135deg, #001848 0%, #003d9b 50%, #0052cc 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background circles */}
        <Box
          sx={{
            position: 'absolute',
            top: '-40%',
            right: '-10%',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: '-30%',
            left: '-5%',
            width: 350,
            height: 350,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
            pointerEvents: 'none',
          }}
        />

        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Box
              component="img"
              src="/auto-head.png"
              alt="Auto"
              sx={{
                width: 100,
                height: 'auto',
                mb: 3,
                filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.3))',
                animation: 'float-cta 4s ease-in-out infinite',
                '@keyframes float-cta': {
                  '0%, 100%': { transform: 'translateY(0)' },
                  '50%': { transform: 'translateY(-10px)' },
                },
              }}
            />
            <Typography
              component="h2"
              sx={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontWeight: 800,
                fontSize: { xs: '2rem', md: '2.75rem' },
                letterSpacing: '-0.03em',
                color: '#ffffff',
                mb: 2,
                lineHeight: 1.15,
              }}
            >
              Ready to let Auto handle your job search?
            </Typography>
            <Typography
              sx={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '1.1rem',
                color: 'rgba(196, 210, 255, 0.9)',
                mb: 4,
                maxWidth: 480,
                mx: 'auto',
                lineHeight: 1.65,
              }}
            >
              Join thousands of job seekers who've accelerated their careers with CareerPilot.
              Free to get started.
            </Typography>
            <Button
              variant="contained"
              size="large"
              endIcon={<RocketLaunchIcon />}
              onClick={() => navigate('/login?tab=signup')}
              sx={{
                background: '#ffffff',
                color: '#003d9b',
                fontWeight: 700,
                fontSize: '1.05rem',
                borderRadius: '12px',
                px: 4,
                py: 1.5,
                boxShadow: '0 6px 28px rgba(0,0,0,0.2)',
                '&:hover': {
                  background: '#dae2ff',
                  boxShadow: '0 8px 36px rgba(0,0,0,0.3)',
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.25s ease',
              }}
            >
              Get Started — It's Free
            </Button>
          </Box>
        </Container>
      </Box>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <Box
        sx={{
          py: 4,
          px: 4,
          background: '#f9f9ff',
          borderTop: '1px solid #e1e8fd',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <img src="/auto-logo.png" alt="Auto" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          <Typography
            sx={{
              fontFamily: '"Hanken Grotesk", sans-serif',
              fontWeight: 700,
              fontSize: '0.95rem',
              color: '#003d9b',
              letterSpacing: '-0.01em',
            }}
          >
            CareerPilot
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.8rem', color: '#737685', fontFamily: '"Hanken Grotesk", sans-serif' }}>
          © 2025 CareerPilot · IUT Shonghorsho · All rights reserved
        </Typography>
      </Box>
    </Box>
  );
}

export default HomePage;
