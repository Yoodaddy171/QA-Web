'use client';

import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-border bg-card p-8">
          <div className="text-center space-y-4 max-w-md">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/15">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Something went wrong</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {this.state.error?.message || 'An unexpected error occurred.'}
              </p>
            </div>
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
              variant="outline"
              className="gap-2 rounded-xl"
            >
              <RefreshCw className="h-4 w-4" /> Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
