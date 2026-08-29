export interface GlobalErrorOptions {
  onError?: (error: unknown) => void;
  onHttpError?: (error: unknown) => void;
}

// Global symbols ensuring a single shared registry across microfrontends
const HANDLED_ERRORS_KEY = Symbol.for(
  "__REACT_MICRO_BOUNDARY_HANDLED_ERRORS__",
);
const INIT_FLAG_KEY = Symbol.for("__REACT_MICRO_BOUNDARY_INIT_FLAG__");

interface ExtendedWindow extends Window {
  [HANDLED_ERRORS_KEY]?: WeakSet<object>;
  [INIT_FLAG_KEY]?: boolean;
}

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
 * Initializes global error listeners (window.onerror and onunhandledrejection).
 * Deferring execution with queueMicrotask allows React Error Boundaries
 * to catch and flag errors first.
 */
export function initGlobalErrorHandlers(
  options: GlobalErrorOptions = {},
): void {
  if (typeof window === "undefined") return;

  // Prevent duplicate listener registration across multiple microfrontends
  if (window[INIT_FLAG_KEY]) return;
  window[INIT_FLAG_KEY] = true;

  const { onError, onHttpError } = options;

  // 1. Synchronous and runtime JS errors
  window.addEventListener("error", (event: ErrorEvent) => {
    // Ignore resource loading errors (e.g., <img />, <script />, <link />)
    if (event.target && event.target !== window) return;

    const error = event.error || new Error(event.message);

    queueMicrotask(() => {
      if (isErrorHandled(error)) return;
      onError?.(error);
    });
  });

  // 2. Unhandled Promise Rejections / HTTP errors
  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
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
    },
  );
}
