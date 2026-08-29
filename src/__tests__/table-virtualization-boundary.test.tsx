import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SmartErrorBoundary,
  initGlobalErrorHandlers,
  resetGlobalErrorHandlers,
} from "../index";

// Helper component that throws an error during render
const BrokenCell = ({ rowIndex }: { rowIndex: number }) => {
  throw new Error(`Render crash at row ${rowIndex}`);
};

// Table component supporting optional boundary wrapping per cell
interface TableProps {
  rowsCount?: number;
  useBoundary?: boolean;
  onCellError?: (error: unknown) => void;
}

const HeavyTable = ({
  rowsCount = 10,
  useBoundary = false,
  onCellError,
}: TableProps) => {
  const rows = Array.from({ length: rowsCount }, (_, i) => i);
  const columns = ["ID", "Name", "Status", "Actions"];

  return (
    <table>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((rowIndex) => (
          <tr key={rowIndex}>
            <td>{rowIndex + 1}</td>
            <td>User {rowIndex + 1}</td>
            <td>Active</td>
            <td>
              {/* Column 4 contains broken JSX elements */}
              {useBoundary ? (
                <SmartErrorBoundary
                  fallback={<span>Fallback Cell</span>}
                  onError={onCellError}
                >
                  <BrokenCell rowIndex={rowIndex} />
                </SmartErrorBoundary>
              ) : (
                <BrokenCell rowIndex={rowIndex} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

describe("Table Virtualization & Cell Error Boundaries", () => {
  beforeEach(() => {
    // Suppress React console noise during intentional error throwing
    vi.spyOn(console, "error").mockImplementation(() => {});
    resetGlobalErrorHandlers();
  });

  it("logs all 10 unhandled errors when table cells render without boundary", async () => {
    const onErrorGlobal = vi.fn();
    initGlobalErrorHandlers({ onError: onErrorGlobal });

    // Expect standard React render to throw due to unhandled exceptions in children
    expect(() => {
      render(<HeavyTable rowsCount={10} useBoundary={false} />);
    }).toThrow();

    // Dispatch simulated window errors for all 10 unhandled row crashes
    for (let i = 0; i < 10; i++) {
      const err = new Error(`Render crash at row ${i}`);
      const errorEvent = new ErrorEvent("error", {
        error: err,
        message: err.message,
        bubbles: true,
        cancelable: true,
      });

      Object.defineProperty(errorEvent, "target", {
        value: window,
        enumerable: true,
      });

      Object.defineProperty(errorEvent, "error", {
        value: err,
        enumerable: true,
      });

      window.dispatchEvent(errorEvent);
    }

    // Wait for microtask queue execution
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Without boundary, every single unhandled error triggers the global logger
    expect(onErrorGlobal).toHaveBeenCalledTimes(10);
  });

  it("replaces broken cells with fallback UI and prevents cascading crashes when using boundary", async () => {
    const onErrorGlobal = vi.fn();
    const caughtErrors: unknown[] = [];

    initGlobalErrorHandlers({ onError: onErrorGlobal });

    render(
      <HeavyTable
        rowsCount={10}
        useBoundary={true}
        onCellError={(err) => caughtErrors.push(err)}
      />,
    );

    // 1. Verify table rendered successfully and replaced broken cells with fallbacks
    const fallbacks = screen.getAllByText("Fallback Cell");
    expect(fallbacks).toHaveLength(10);

    // 2. Verify healthy cells in other columns are intact
    expect(screen.getByText("User 1")).toBeInTheDocument();
    expect(screen.getByText("User 10")).toBeInTheDocument();

    // 3. Dispatch global window error event using the exact reference caught by ErrorBoundary
    const handledErr = caughtErrors[0];
    expect(handledErr).toBeDefined();

    const errorEvent = new ErrorEvent("error", {
      error: handledErr,
      message: (handledErr as Error).message,
    });

    Object.defineProperty(errorEvent, "target", {
      value: window,
      enumerable: true,
    });

    Object.defineProperty(errorEvent, "error", {
      value: handledErr,
      enumerable: true,
    });

    window.dispatchEvent(errorEvent);

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Global logger must NOT be called for errors caught by SmartErrorBoundary
    expect(onErrorGlobal).not.toHaveBeenCalled();
  });
});
