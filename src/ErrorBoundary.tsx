import React, { Component, ReactNode, ErrorInfo } from "react";
import { markErrorAsHandled } from "./globalErrors";

export interface FallbackProps {
  error: Error | null;
  resetErrorBoundary: () => void;
}

export interface SmartErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode | ((props: FallbackProps) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SmartErrorBoundary extends Component<
  SmartErrorBoundaryProps,
  State
> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Mark the error in the shared WeakSet before microtasks execute
    markErrorAsHandled(error);
    this.props.onError?.(error, errorInfo);
  }

  public resetErrorBoundary = (): void => {
    this.setState({ hasError: false, error: null });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      const { fallback } = this.props;

      // 1. Function / Render Prop
      if (typeof fallback === "function") {
        return fallback({
          error: this.state.error,
          resetErrorBoundary: this.resetErrorBoundary,
        });
      }

      // 2. Static JSX or null (Silent mode)
      if (fallback !== undefined) {
        return fallback;
      }

      // 3. Default fallback
      return <span>Failed to render component</span>;
    }

    return this.props.children;
  }
}
