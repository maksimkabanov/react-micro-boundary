# react-micro-boundary

A lightweight, microtask-powered React Error Boundary combined with global window error handlers (`window.onerror` and `unhandledrejection`). Designed specifically for microfrontend architectures, data-heavy applications, and modern React setups to eliminate duplicate error reporting and support structural telemetry.

---

## Features

- **Microtask-Based Deduplication:** Suppresses duplicate `window.onerror` and `unhandledrejection` triggers for errors caught by React Error Boundaries using native `queueMicrotask` and a global `WeakSet`.
- **Microfrontend Isolation:** Built with global `Symbol` registries on `window` to operate seamlessly across separate micro-app bundles and host shells.
- **Enterprise Telemetry Support:** Includes `<TelemetryErrorBoundary />` for enriching error payloads with structural metadata (`type`, `boundaryId`, `metadata`) ideal for telemetry platforms like Sentry, Azure Application Insights, or Datadog.

---

## Problem

When an unhandled error occurs during a React component render, standard React Error Boundaries catch it locally to prevent the entire page from breaking. However, global error trackers (like Sentry, LogRocket, or native `window.onerror` / `onunhandledrejection` listeners) often catch the exact same error independently.

This causes two main issues:

1. **Duplicate Error Logs:** The same runtime failure gets reported twice—once by the Error Boundary and once by the global handler.
2. **Microfrontend Noise:** In microfrontend setups, a non-fatal failure in a single minor widget can trigger global error alerts across the entire container application (Shell).

---

## Solution

`react-micro-boundary` bridges the gap between React's render-phase error boundaries and browser-level error listeners using **microtasks** and a shared **global registry (`WeakSet`)**:

1. **Local Interception:** When an error occurs in a React component, `<SmartErrorBoundary>` catches it and immediately tags the error object in a shared `WeakSet`.
2. **Microtask Deferral:** Global listeners (`window.onerror` and `unhandledrejection`) defer their fallback actions to the microtask queue using `queueMicrotask`.
3. **Deduplication:** When the global handler executes on the microtask tick, it checks if the error has already been tagged by a React Error Boundary. If it has, the global handler silently ignores it.

Because the error registry is attached to the global `window` instance using native JavaScript `Symbol` identifiers, this deduplication logic works seamlessly across multiple microfrontend bundles.

---

## Installation

```bash
npm install react-micro-boundary
# or
yarn add react-micro-boundary
# or
pnpm add react-micro-boundary
```

## Quick Start

1. **Initialize Global Listeners (Host / Entry Point)**
   Call initGlobalErrorHandlers once at the root entry point of your application (or inside your Host app shell):

```typescript
import { initGlobalErrorHandlers } from "react-micro-boundary";

initGlobalErrorHandlers({
  onError: (error) => {
    // Only unhandled global JS errors reach here
    console.error("Unhandled Global Error:", error);
  },
  onHttpError: (error) => {
    // Unhandled promise rejections identified as network/HTTP errors
    console.error("Unhandled HTTP Error:", error);
  },
});
```

2. **Wrap Components with SmartErrorBoundary**
   Wrap any React component tree or microfrontend widget with `<SmartErrorBoundary>`:

```typescript
import React from 'react';
import { SmartErrorBoundary } from 'react-micro-boundary';
import { MyWidget } from './MyWidget';

export function App() {
  return (
    <SmartErrorBoundary
      fallback={<div>Failed to render widget.</div>}
      onError={(error, errorInfo) => {
        console.log('Caught locally by Error Boundary:', error);
      }}
    >
      <MyWidget />
    </SmartErrorBoundary>
  );
}
```

## Usage Scenarios

Render Prop Fallback with Reset Capability
You can pass a function to fallback to render custom UI with access to the error object and a resetErrorBoundary callback:

```typescript
<SmartErrorBoundary
  fallback={({ error, resetErrorBoundary }) => (
    <div className="error-card">
      <p>Something went wrong!</p>
      <pre>{error?.message}</pre>
      <button onClick={resetErrorBoundary}>Try Again</button>
    </div>
  )}
>
  <ComplexComponent />
</SmartErrorBoundary>
```

## Silent Fallback

If a failing component is non-critical (e.g., an optional recommendation widget), set `fallback={null}` to hide it cleanly without breaking the rest of the page:

```typescript
<SmartErrorBoundary fallback={null}>
  <OptionalBannerWidget/>
</SmartErrorBoundary>
```

## Enterprise Telemetry Boundary (`<TelemetryErrorBoundary />`)

In large data-heavy enterprise applications or microfrontends, you often need to classify errors by zone or widget type (e.g., TABLE_CELL, NAVBAR, SIDEBAR_WIDGET).
Use `<TelemetryErrorBoundary />` to attach structural metadata to error payloads before sending them to your telemetry service:

```typescript
import React from 'react';
import { TelemetryErrorBoundary } from 'react-micro-boundary';

export function Dashboard() {
  return (
    <TelemetryErrorBoundary
      type="TABLE_CELL"
      boundaryId="cell_row_12_col_4"
      metadata={{ reportId: 'BI_REPORT_99', column: 'Revenue' }}
      fallback={<span>Error loading cell</span>}
      onError={(error, context) => {
        // Enriched payload ready for AppInsights / Sentry / Datadog
        telemetryTracker.trackException({
          exception: error,
          properties: {
            boundaryType: context.boundaryType, // "TABLE_CELL"
            boundaryId: context.boundaryId,     // "cell_row_12_col_4"
            ...context.metadata,
          },
        });
      }}
    >
      <HeavyCellDataCalculator />
    </TelemetryErrorBoundary>
  );
}
```

## Microfrontend Usage

In microfrontend setups (Webpack Module Federation, Vite Single-SPA, independent script tags), separate micro-app bundles **cannot share JS module scope**. A standard module-level `WeakSet` breaks down because each bundle gets its own isolated instance in memory.

`react-micro-boundary` solves this by using native JavaScript `Symbol.for()` attached to the global `window` object. This creates a **single shared global anchor** across all independent micro-frontend bundles without leaking internal state into module scopes.

Host App (Shell): Calls `initGlobalErrorHandlers()` to manage page-level error monitoring.
Remote Apps (Widgets): Simply import `<SmartErrorBoundary>` and wrap top-level widget components.

```
[ Host Shell Application ]
  ├── Calls initGlobalErrorHandlers()
  │
  ├──> [ Remote Microfrontend A ] ──> Uses <SmartErrorBoundary> (Suppresses global error)
  └──> [ Remote Microfrontend B ] ──> Uses <SmartErrorBoundary> (Suppresses global error)
```

Errors caught inside any remote Error Boundary are marked in the global `WeakSet`, keeping the Host application clean from duplicate error reports.

## API Reference

### `initGlobalErrorHandlers(options)`

| Option        | Type                       | Description                                                                                                                              |
| :------------ | :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `onError`     | `(error: unknown) => void` | Callback triggered for unhandled global JavaScript errors that were **not** caught by any Error Boundary.                                |
| `onHttpError` | `(error: unknown) => void` | Callback triggered for unhandled promise rejections identified as network/HTTP errors (`status`, `response`, or `name === 'HttpError'`). |

### `<SmartErrorBoundary />`

| Prop       | Type                                                 | Default                                   | Description                                                                |
| :--------- | :--------------------------------------------------- | :---------------------------------------- | :------------------------------------------------------------------------- |
| `fallback` | `ReactNode \| ((props: FallbackProps) => ReactNode)` | `<span>Failed to render component</span>` | Custom UI element or render prop function to display when an error occurs. |
| `onError`  | `(error: Error, errorInfo: ErrorInfo) => void`       | `undefined`                               | Callback invoked when an error is caught by the boundary.                  |

## License

MIT
