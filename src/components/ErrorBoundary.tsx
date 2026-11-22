import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in WhimsyMaya ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let parsedDetails: Record<string, unknown> | null = null;
      try {
        parsedDetails = JSON.parse(this.state.errorMessage);
      } catch {
        parsedDetails = null;
      }

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-semibold">Application Security or Runtime Alert</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              WhimsyMaya encountered an operation restriction or unexpected state. Your workspace data remains safe.
            </p>
            {parsedDetails ? (
              <div className="bg-slate-100 dark:bg-slate-800/80 rounded-lg p-3 text-xs font-mono text-slate-700 dark:text-slate-300 space-y-1 mb-5 overflow-x-auto">
                <div>Operation: {String(parsedDetails.operationType || 'unknown')}</div>
                <div>Path: {String(parsedDetails.path || 'unknown')}</div>
                <div>Detail: {String(parsedDetails.error || '')}</div>
              </div>
            ) : (
              <div className="bg-slate-100 dark:bg-slate-800/80 rounded-lg p-3 text-xs font-mono text-slate-700 dark:text-slate-300 mb-5 break-words">
                {this.state.errorMessage}
              </div>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
