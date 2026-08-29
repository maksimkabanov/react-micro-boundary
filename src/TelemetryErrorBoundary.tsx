import React from "react";
import { SmartErrorBoundary } from "./ErrorBoundary";
import { SmartErrorBoundaryProps } from "./types";

export interface TelemetryErrorContext {
  boundaryType: string;
  boundaryId?: string;
  metadata?: Record<string, unknown>;
}

export interface TelemetryErrorBoundaryProps extends Omit<
  SmartErrorBoundaryProps,
  "onError"
> {
  type: string;
  boundaryId?: string;
  metadata?: Record<string, unknown>;
  onError?: (error: unknown, context: TelemetryErrorContext) => void;
}

/**
 * Enterprise-ready Error Boundary wrapper that enriches error payloads
 * with structural boundary metadata (type, boundaryId, metadata) for telemetry trackers.
 */
export const TelemetryErrorBoundary: React.FC<TelemetryErrorBoundaryProps> = ({
  type,
  boundaryId,
  metadata,
  onError,
  fallback,
  children,
}) => {
  const handleError = (error: unknown) => {
    const context: TelemetryErrorContext = {
      boundaryType: type,
      boundaryId,
      metadata,
    };

    onError?.(error, context);
  };

  return (
    <SmartErrorBoundary fallback={fallback} onError={handleError}>
      {children}
    </SmartErrorBoundary>
  );
};
