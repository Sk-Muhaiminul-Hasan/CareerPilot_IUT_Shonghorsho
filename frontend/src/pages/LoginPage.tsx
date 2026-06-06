import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

// ─── Perks list shown on left panel ────────────────────────────────────────────

const PERKS = [
  'AI-powered auto-apply to 500+ job boards',
  'Smart resume tailoring for each application',
  'Real-time application tracking dashboard',
  'Interview prep & career coaching with Auto',
];

// ─── Left decorative panel ──────────────────────────────────────────────────────

function AuthPanel({ isSignUp }: { isSignUp: boolean }) {
  const [mascotLoaded, setMascotLoaded] = useState(false);

  return (
    <Box
      sx={{
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '45%',
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #001848 0%, #003d9b 55%, #0c56d0 100%)',
        padding: '2.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background circles */}
      <Box sx={{ position: 'absolute', top: '-15%', right: '-15%', width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      <Box sx={{ position: 'absolute', bottom: '5%', left: '-10%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      {/* Grid dots */}
      <Box sx={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />

      {/* Top logo */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, position: 'relative', zIndex: 1 }}>
        <img src="/auto-logo.png" alt="Auto" style={{ width: 36, height: 36, objectFit: 'contain' }} />
        <Typography sx={{ fontFamily: '"Hanken Grotesk", sans-serif', fontWeight: 800, fontSize: '1.2rem', color: '#ffffff', letterSpacing: '-0.02em' }}>
          CareerPilot
        </Typography>
      </Box>

      {/* Center content */}
      <Box sx={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', py: 4 }}>
        <Chip
          icon={<AutoAwesomeIcon sx={{ fontSize: '0.8rem !important', color: 'rgba(196,210,255,0.9) !important' }} />}
          label={isSignUp ? 'START YOUR JOURNEY' : 'WELCOME BACK'}
          sx={{ mb: 3, alignSelf: 'flex-start', background: 'rgba(255,255,255,0.1)', color: 'rgba(196,210,255,0.9)', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.07em', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '999px' }}
        />

        <Typography
          sx={{
            fontFamily: '"Hanken Grotesk", sans-serif',
            fontWeight: 800,
            fontSize: '2rem',
            color: '#ffffff',
            lineHeight: 1.2,
            letterSpacing: '-0.025em',
            mb: 1.5,
          }}
        >
          {isSignUp
            ? 'Let Auto supercharge your job search'
            : 'Good to see you again!'}
        </Typography>

        <Typography
          sx={{
            fontFamily: '"Hanken Grotesk", sans-serif',
            fontSize: '0.95rem',
            color: 'rgba(178, 197, 255, 0.85)',
            lineHeight: 1.65,
            mb: 4,
          }}
        >
          {isSignUp
            ? 'Join thousands of job seekers who let Auto handle the grind while they focus on the opportunity.'
            : 'Your dashboard, applications, and Auto are waiting for you. Let\'s keep the momentum going.'}
        </Typography>

        {/* Perks */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {PERKS.map((perk) => (
            <Box key={perk} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CheckCircleOutlineIcon sx={{ color: 'rgba(196,210,255,0.85)', fontSize: '1.1rem', flexShrink: 0 }} />
              <Typography sx={{ fontFamily: '"Hanken Grotesk", sans-serif', fontSize: '0.875rem', color: 'rgba(218, 226, 255, 0.9)', lineHeight: 1.45 }}>
                {perk}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Mascot */}
        <Box
          component="img"
          src={isSignUp ? '/auto-thumbsup.png' : '/auto-waving.png'}
          alt="Auto"
          onLoad={() => setMascotLoaded(true)}
          sx={{
            width: 180,
            height: 'auto',
            mt: 5,
            alignSelf: 'center',
            filter: 'drop-shadow(0 12px 32px rgba(0,0,0,0.3))',
            opacity: mascotLoaded ? 1 : 0,
            animation: mascotLoaded ? 'float-auth 5s ease-in-out infinite' : 'none',
            transition: 'opacity 0.5s ease',
            '@keyframes float-auth': {
              '0%, 100%': { transform: 'translateY(0)' },
              '50%': { transform: 'translateY(-12px)' },
            },
          }}
        />
      </Box>

      {/* Bottom */}
      <Typography sx={{ fontFamily: '"Hanken Grotesk", sans-serif', fontSize: '0.75rem', color: 'rgba(178, 197, 255, 0.5)', position: 'relative', zIndex: 1 }}>
        © 2025 CareerPilot · IUT Shonghorsho
      </Typography>
    </Box>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);

  // Determine initial tab from URL param
  const initialTab = searchParams.get('tab') === 'signup' ? 1 : 0;
  const [tab, setTab] = useState(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setFormVisible(true), 80);
  }, []);

  // Sync tab when URL param changes
  useEffect(() => {
    setTab(searchParams.get('tab') === 'signup' ? 1 : 0);
  }, [searchParams]);

  const isSignUp = tab === 1;

  const switchTab = (newTab: number) => {
    setTab(newTab);
    setError(null);
    setSuccessMsg(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validate passwords match on signup
    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      let result;
      if (!isSignUp) {
        result = await supabase.auth.signInWithPassword({ email, password });
      } else {
        result = await supabase.auth.signUp({ email, password });
      }

      if (result.error) {
        setError(result.error.message);
        return;
      }

      const session = result.data.session;
      const user = result.data.user
        ? { id: result.data.user.id, email: result.data.user.email ?? undefined }
        : null;

      if (isSignUp && !session) {
        // Email confirmation required
        setSuccessMsg(
          'Account created! Please check your email to confirm your address, then sign in.',
        );
        return;
      }

      if (session && user) {
        setSession(session.access_token, user, true);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: '#f9f9ff', fontFamily: '"Hanken Grotesk", sans-serif' }}>
      {/* Left panel */}
      <AuthPanel isSignUp={isSignUp} />

      {/* Right: Form */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          padding: { xs: '2rem 1.25rem', md: '3rem 2.5rem' },
          position: 'relative',
        }}
      >
        {/* Back to home */}
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          sx={{
            position: 'absolute',
            top: 24,
            left: 24,
            color: '#434654',
            fontWeight: 600,
            fontSize: '0.85rem',
            fontFamily: '"Hanken Grotesk", sans-serif',
            '&:hover': { color: '#003d9b', background: 'rgba(0,61,155,0.05)' },
          }}
        >
          Home
        </Button>

        {/* Mobile logo */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1, mb: 4 }}>
          <img src="/auto-logo.png" alt="Auto" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <Typography sx={{ fontFamily: '"Hanken Grotesk", sans-serif', fontWeight: 800, fontSize: '1.1rem', color: '#003d9b' }}>
            CareerPilot
          </Typography>
        </Box>

        <Box
          sx={{
            width: '100%',
            maxWidth: 420,
            opacity: formVisible ? 1 : 0,
            transform: formVisible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          {/* Heading */}
          <Box sx={{ mb: 3.5 }}>
            <Typography
              component="h1"
              sx={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontWeight: 800,
                fontSize: { xs: '1.75rem', md: '2rem' },
                color: '#141b2b',
                letterSpacing: '-0.025em',
                lineHeight: 1.2,
                mb: 0.75,
              }}
            >
              {isSignUp ? 'Create your account' : 'Sign in to CareerPilot'}
            </Typography>
            <Typography
              sx={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '0.95rem',
                color: '#434654',
                lineHeight: 1.5,
              }}
            >
              {isSignUp
                ? 'Start your AI-powered job search journey today.'
                : 'Welcome back — Auto has been busy finding jobs for you!'}
            </Typography>
          </Box>

          {/* Tab switcher */}
          <Box
            sx={{
              display: 'flex',
              background: '#e9edff',
              borderRadius: '12px',
              p: '4px',
              mb: 3,
              position: 'relative',
            }}
          >
            {['Sign In', 'Sign Up'].map((label, i) => (
              <Box
                key={label}
                component="button"
                id={`auth-tab-${label.toLowerCase().replace(' ', '-')}`}
                onClick={() => switchTab(i)}
                sx={{
                  flex: 1,
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '9px',
                  py: 1,
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  transition: 'all 0.25s ease',
                  background: tab === i ? '#ffffff' : 'transparent',
                  color: tab === i ? '#003d9b' : '#737685',
                  boxShadow: tab === i ? '0 2px 8px rgba(0,61,155,0.12)' : 'none',
                }}
              >
                {label}
              </Box>
            ))}
          </Box>

          {/* Alerts */}
          {error && (
            <Alert
              severity="error"
              sx={{ mb: 2.5, borderRadius: '10px', fontFamily: '"Hanken Grotesk", sans-serif', fontSize: '0.875rem' }}
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}
          {successMsg && (
            <Alert
              severity="success"
              sx={{ mb: 2.5, borderRadius: '10px', fontFamily: '"Hanken Grotesk", sans-serif', fontSize: '0.875rem' }}
            >
              {successMsg}
            </Alert>
          )}

          {/* Form */}
          <Box
            component="form"
            id="auth-form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              id="auth-email"
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoFocus
              autoComplete="email"
              sx={{
                '& .MuiInputLabel-root': { fontFamily: '"Hanken Grotesk", sans-serif', fontSize: '0.9rem' },
                '& .MuiInputBase-input': { fontFamily: '"Hanken Grotesk", sans-serif', fontSize: '0.95rem' },
              }}
            />

            <TextField
              id="auth-password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      id="toggle-password-visibility"
                      onClick={() => setShowPassword((s) => !s)}
                      edge="end"
                      size="small"
                      aria-label="toggle password visibility"
                    >
                      {showPassword ? (
                        <VisibilityOffIcon sx={{ fontSize: '1.1rem', color: '#737685' }} />
                      ) : (
                        <VisibilityIcon sx={{ fontSize: '1.1rem', color: '#737685' }} />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiInputLabel-root': { fontFamily: '"Hanken Grotesk", sans-serif', fontSize: '0.9rem' },
                '& .MuiInputBase-input': { fontFamily: '"Hanken Grotesk", sans-serif', fontSize: '0.95rem' },
              }}
            />

            {isSignUp && (
              <TextField
                id="auth-confirm-password"
                label="Confirm password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required={isSignUp}
                fullWidth
                autoComplete="new-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        id="toggle-confirm-password-visibility"
                        onClick={() => setShowConfirmPassword((s) => !s)}
                        edge="end"
                        size="small"
                        aria-label="toggle confirm password visibility"
                      >
                        {showConfirmPassword ? (
                          <VisibilityOffIcon sx={{ fontSize: '1.1rem', color: '#737685' }} />
                        ) : (
                          <VisibilityIcon sx={{ fontSize: '1.1rem', color: '#737685' }} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiInputLabel-root': { fontFamily: '"Hanken Grotesk", sans-serif', fontSize: '0.9rem' },
                  '& .MuiInputBase-input': { fontFamily: '"Hanken Grotesk", sans-serif', fontSize: '0.95rem' },
                }}
              />
            )}

            <Button
              id="auth-submit-btn"
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                mt: 0.5,
                py: 1.5,
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: '1rem',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #003d9b 0%, #0052cc 100%)',
                boxShadow: '0 4px 20px rgba(0, 61, 155, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #001848 0%, #003d9b 100%)',
                  boxShadow: '0 6px 28px rgba(0, 61, 155, 0.4)',
                  transform: 'translateY(-1px)',
                },
                '&:disabled': { background: '#c3c6d6', boxShadow: 'none' },
                transition: 'all 0.2s ease',
              }}
            >
              {loading ? (
                <CircularProgress size={22} sx={{ color: '#fff' }} />
              ) : isSignUp ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </Button>
          </Box>

          <Divider sx={{ my: 3, borderColor: '#dce2f7' }}>
            <Typography sx={{ fontFamily: '"Hanken Grotesk", sans-serif', fontSize: '0.8rem', color: '#737685', px: 1 }}>
              or
            </Typography>
          </Divider>

          {/* Switch tab link */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontFamily: '"Hanken Grotesk", sans-serif', fontSize: '0.875rem', color: '#434654' }}>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <Box
                component="span"
                id={isSignUp ? 'switch-to-signin' : 'switch-to-signup'}
                onClick={() => switchTab(isSignUp ? 0 : 1)}
                sx={{
                  color: '#003d9b',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(0,61,155,0.3)',
                  '&:hover': { textDecorationColor: '#003d9b' },
                }}
              >
                {isSignUp ? 'Sign in' : 'Sign up free'}
              </Box>
            </Typography>
          </Box>

          {/* Trust indicators */}
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
            {['🔒 Secure', '⚡ Instant Setup', '✨ Free to Start'].map((item) => (
              <Typography
                key={item}
                sx={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '0.75rem',
                  color: '#737685',
                  fontWeight: 500,
                }}
              >
                {item}
              </Typography>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default LoginPage;
