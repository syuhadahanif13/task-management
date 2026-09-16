import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-zinc-200 shadow-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-zinc-900">Terjadi kesalahan aplikasi</h2>
            <p className="text-xs text-zinc-600 whitespace-pre-wrap">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
              }}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 rounded-lg"
            >
              Coba lagi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
