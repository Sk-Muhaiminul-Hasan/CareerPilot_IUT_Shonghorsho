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
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const token = session?.access_token ?? null;
      const user = session?.user
        ? { id: session.user.id, email: session.user.email ?? undefined }
        : null;
      setSession(token, user, true);
    };

    void getSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const token = session?.access_token ?? null;
        const user = session?.user
          ? { id: session.user.id, email: session.user.email ?? undefined }
          : null;
        setSession(token, user, true);
      },
    );

    return () => subscription.subscription.unsubscribe();
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
