import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SmartErrorBoundary,
  initGlobalErrorHandlers,
  resetGlobalErrorHandlers,
  isErrorHandled,
  markErrorAsHandled,
} from "../index";

// Helper component that intentionally throws an error during rendering
const ProblemChild = ({ message = "Render Error" }: { message?: string }) => {
  throw new Error(message);
};

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("react-micro-boundary", () => {
  beforeEach(() => {
    // Suppress React console errors in test output
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Clean up active listeners and reset initialization state between tests
    resetGlobalErrorHandlers();
  });

  describe("SmartErrorBoundary", () => {
    it("renders children when there is no error", () => {
      render(
        <SmartErrorBoundary>
          <div>Healthy Component</div>
        </SmartErrorBoundary>,
      );

      expect(screen.getByText("Healthy Component")).toBeInTheDocument();
    });

    it("renders default fallback UI when an error is thrown", () => {
      render(
        <SmartErrorBoundary>
          <ProblemChild />
        </SmartErrorBoundary>,
      );

      expect(
        screen.getByText("Failed to render component"),
      ).toBeInTheDocument();
    });

    it("renders custom JSX fallback", () => {
      render(
        <SmartErrorBoundary fallback={<div>Custom Error UI</div>}>
          <ProblemChild />
        </SmartErrorBoundary>,
      );

      expect(screen.getByText("Custom Error UI")).toBeInTheDocument();
    });

    it("supports render prop fallback with reset functionality", () => {
      const { rerender } = render(
        <SmartErrorBoundary
          fallback={({ error, resetErrorBoundary }) => (
            <div>
              <span>Error: {error?.message}</span>
              <button onClick={resetErrorBoundary}>Reset</button>
            </div>
          )}
        >
          <ProblemChild message="Explosion!" />
        </SmartErrorBoundary>,
      );

      expect(screen.getByText("Error: Explosion!")).toBeInTheDocument();

      // Trigger reset callback
      screen.getByText("Reset").click();

      // Re-render with a healthy component after state reset
      rerender(
        <SmartErrorBoundary fallback={<div>Error</div>}>
          <div>Recovered Component</div>
        </SmartErrorBoundary>,
      );

      expect(screen.getByText("Recovered Component")).toBeInTheDocument();
    });

    it("marks caught error as handled in the global WeakSet", () => {
      let caughtError: Error | null = null;

      render(
        <SmartErrorBoundary
          onError={(error) => {
            caughtError = error;
          }}
        >
          <ProblemChild message="Mark test" />
        </SmartErrorBoundary>,
      );

      expect(caughtError).not.toBeNull();
      expect(isErrorHandled(caughtError)).toBe(true);
    });
  });

  describe("globalErrors & Deduplication Logic", () => {
    it("manually marks and checks handled errors", () => {
      const err = new Error("Test error");
      expect(isErrorHandled(err)).toBe(false);

      markErrorAsHandled(err);
      expect(isErrorHandled(err)).toBe(true);
    });

    it("ignores errors in global handler if they were marked by ErrorBoundary", async () => {
      const onErrorGlobal = vi.fn();
      initGlobalErrorHandlers({ onError: onErrorGlobal });

      const handledError = new Error("Handled by React");

      // 1. Simulate an error intercepted by React Error Boundary
      markErrorAsHandled(handledError);

      // 2. Simulate window.onerror event dispatch
      const errorEvent = new ErrorEvent("error", {
        error: handledError,
        message: handledError.message,
      });
      window.dispatchEvent(errorEvent);

      // 3. Wait for microtasks execution
      await flushMicrotasks();

      // Global handler should NOT be triggered
      expect(onErrorGlobal).not.toHaveBeenCalled();
    });

    it("triggers global onError for unhandled JS errors", async () => {
      const onErrorGlobal = vi.fn();
      initGlobalErrorHandlers({ onError: onErrorGlobal });

      const unhandledError = new Error("Unhandled global crash");

      // Create event with explicit target and error object for jsdom compatibility
      const errorEvent = new ErrorEvent("error", {
        error: unhandledError,
        message: unhandledError.message,
        bubbles: true,
        cancelable: true,
      });

      Object.defineProperty(errorEvent, "target", {
        value: window,
        enumerable: true,
      });

      Object.defineProperty(errorEvent, "error", {
        value: unhandledError,
        enumerable: true,
      });

      window.dispatchEvent(errorEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(onErrorGlobal).toHaveBeenCalledWith(unhandledError);
    });
  });
});
