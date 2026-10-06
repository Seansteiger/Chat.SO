import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { ConvexProvider } from 'convex/react';
import { convex } from './convex.js';
import { AuthProvider } from './hooks/useAuth.js';
import App from './App.js';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Chat.SO Error Boundary caught]:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#090d16] text-white flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900/80 border border-white/10 shadow-2xl">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center text-xl font-bold">
              !
            </div>
            <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
            <p className="text-xs text-slate-400 mb-6">
              An unexpected issue occurred while rendering the application.
            </p>
            <button
              onClick={() => {
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then((regs) => {
                    for (const r of regs) r.unregister();
                  });
                }
                window.location.reload();
              }}
              className="w-full py-2.5 px-4 rounded-xl font-medium text-sm text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
            >
              Refresh Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConvexProvider client={convex}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ConvexProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
