import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelemetryErrorBoundary, resetGlobalErrorHandlers } from "../index";

const ProblemChild = () => {
  throw new Error("Widget failed");
};

describe("TelemetryErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    resetGlobalErrorHandlers();
  });

  it("passes error and enriched telemetry context to onError callback", () => {
    const onErrorMock = vi.fn();

    render(
      <TelemetryErrorBoundary
        type="DASHBOARD_WIDGET"
        boundaryId="widget_gantt_01"
        metadata={{ env: "production", reportId: 42 }}
        fallback={<div>Widget Fallback</div>}
        onError={onErrorMock}
      >
        <ProblemChild />
      </TelemetryErrorBoundary>,
    );

    expect(screen.getByText("Widget Fallback")).toBeInTheDocument();
    expect(onErrorMock).toHaveBeenCalledTimes(1);

    const [caughtError, context] = onErrorMock.mock.calls[0];

    expect(caughtError).toEqual(new Error("Widget failed"));
    expect(context).toEqual({
      boundaryType: "DASHBOARD_WIDGET",
      boundaryId: "widget_gantt_01",
      metadata: { env: "production", reportId: 42 },
    });
  });
});
