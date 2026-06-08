import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import App from './App';
import theme from './theme';
import { useAuthStore } from './store/useAuthStore';
import { supabase } from './lib/supabase';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthHydrator({ children }: { children: React.ReactNode }) {
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    let cancelled = false;

    const finishHydration = (
      token: string | null,
      user: ReturnType<typeof useAuthStore.getState>['user'],
    ) => {
      if (cancelled) return;
      setSession(token, user, true);
    };

    // Hard fallback: if Supabase never responds (e.g. invalid key, network
    // blocked), don't trap the whole app on the "Verifying session..."
    // spinner. Continue as logged out after 1.5s.
    const fallback = window.setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn('Supabase hydration timed out; continuing unauthenticated.');
      finishHydration(null, null);
    }, 1500);

    const getSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        const token = session?.access_token ?? null;
        const user = session?.user
          ? { id: session.user.id, email: session.user.email ?? undefined }
          : null;
        finishHydration(token, user);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Supabase getSession failed; continuing unauthenticated.', err);
        finishHydration(null, null);
      } finally {
        window.clearTimeout(fallback);
      }
    };

    void getSession();

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, [setSession]);

  return <>{children}</>;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AuthHydrator>
            <App />
          </AuthHydrator>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
