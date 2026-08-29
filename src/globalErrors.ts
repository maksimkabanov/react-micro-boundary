import { HANDLED_ERRORS_KEY, INIT_FLAG_KEY, LISTENERS_KEY } from "./constants";
import { ExtendedWindow, GlobalErrorOptions } from "./types";

declare const window: ExtendedWindow;

// Initialize a shared WeakSet on the window object
if (typeof window !== "undefined" && !window[HANDLED_ERRORS_KEY]) {
  window[HANDLED_ERRORS_KEY] = new WeakSet();
}

/**
 * Marks an error as handled by a React Error Boundary.
 */
export function markErrorAsHandled(error: unknown): void {
  if (error && typeof error === "object" && typeof window !== "undefined") {
    window[HANDLED_ERRORS_KEY]?.add(error);
  }
}

/**
 * Checks whether the error has already been handled by an Error Boundary.
 */
export function isErrorHandled(error: unknown): boolean {
  if (!error || typeof error !== "object" || typeof window === "undefined") {
    return false;
  }
  return window[HANDLED_ERRORS_KEY]?.has(error) ?? false;
}

/**
 * Removes global error listeners and resets the initialization state.
 * Useful for test suites and hot module replacement.
 */
export function resetGlobalErrorHandlers(): void {
  if (typeof window === "undefined") return;

  const listeners = (window as any)[LISTENERS_KEY];
  if (listeners) {
    if (listeners.error) {
      window.removeEventListener("error", listeners.error);
    }
    if (listeners.unhandledrejection) {
      window.removeEventListener(
        "unhandledrejection",
        listeners.unhandledrejection,
      );
    }
    delete (window as any)[LISTENERS_KEY];
  }

  delete window[INIT_FLAG_KEY];

  // Reset the deduplication set so cross-test or cross-app state does not
  // leak into later error checks.
  window[HANDLED_ERRORS_KEY] = new WeakSet();
}

/**
 * Initializes global error listeners (window.onerror and onunhandledrejection).
 * Deferring execution with queueMicrotask allows React Error Boundaries
 * to catch and flag errors first.
 */
export function initGlobalErrorHandlers(
  options: GlobalErrorOptions = {},
): void {
  if (typeof window === "undefined") return;

  if (!window[HANDLED_ERRORS_KEY]) {
    window[HANDLED_ERRORS_KEY] = new WeakSet();
  }

  // Prevent duplicate listener registration across multiple microfrontends
  if (window[INIT_FLAG_KEY]) return;
  window[INIT_FLAG_KEY] = true;

  const { onError, onHttpError } = options;

  // 1. Synchronous and runtime JS errors
  const errorListener = (event: ErrorEvent) => {
    // Ignore resource loading errors (e.g., <img />, <script />, <link />)
    if (event.target && event.target !== window) return;

    const error = event.error || new Error(event.message);

    queueMicrotask(() => {
      if (isErrorHandled(error)) return;
      onError?.(error);
    });
  };

  // 2. Unhandled Promise Rejections / HTTP errors
  const rejectionListener = (event: PromiseRejectionEvent) => {
    const reason = event.reason;

    queueMicrotask(() => {
      if (isErrorHandled(reason)) return;

      const isHttp = Boolean(
        reason &&
        typeof reason === "object" &&
        ("status" in reason ||
          ("name" in reason && reason.name === "HttpError") ||
          "response" in reason),
      );

      if (isHttp && onHttpError) {
        onHttpError(reason);
      } else if (onError) {
        onError(reason);
      }
    });
  };

  // Store active listeners directly on window under a unique symbol
  (window as any)[LISTENERS_KEY] = {
    error: errorListener,
    unhandledrejection: rejectionListener,
  };

  window.addEventListener("error", errorListener);
  window.addEventListener("unhandledrejection", rejectionListener);
}
