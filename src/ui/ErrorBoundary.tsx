/**
 * Catches a render error below it and shows it instead of the page, so one
 * uncaught error doesn't unmount the whole app and leave it blank. Red = bad,
 * with a `×` mark so it never relies on hue alone. `AppShell` passes the path
 * as `resetKey`, so navigating away clears the error. Errors in event handlers and promises
 * don't reach it (React only routes render and lifecycle errors here).
 */
import { Component, type ReactNode } from 'react';
import { COPY } from './copy';
import { errorText } from './errorBoundaryText';

interface Props {
  /** A change clears a caught error. Not a React `key`: that would remount the children on every change. */
  resetKey: string;
  children: ReactNode;
}

interface State {
  error: unknown;
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, failed: false };

  static getDerivedStateFromError(error: unknown): State {
    return { error, failed: true };
  }

  override componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ error: null, failed: false });
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" data-error-boundary className="m-4 border-l-4 border-bad bg-surface p-3 text-sm text-text">
        <p className="font-semibold">
          <span aria-hidden="true">× </span>
          {COPY.pageError}
        </p>
        <p className="mt-1 break-words font-mono text-muted">{errorText(this.state.error)}</p>
      </div>
    );
  }
}
