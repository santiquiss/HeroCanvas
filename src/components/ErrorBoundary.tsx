// Keeps a failing component from blanking the whole tool: shows the error where it happened, with a retry.
import { Component, type ReactNode } from 'react';

interface Props {
  /** Short name of what failed ("story Primary", "page Settings"). */
  label: string;
  /** Re-mounts the children when it changes (e.g. the route or story args). */
  resetKey?: string;
  /** Fill the area (pages, gallery) instead of an inline box (stories). */
  fill?: boolean;
  /** Extra actions under the message (e.g. "Back to home"). */
  actions?: ReactNode;
  children: ReactNode;
}

interface State {
  error: Error | null;
  key?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // A new resetKey (navigation, new args) clears the error.
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error) {
    console.error(`[hc] ${this.props.label} failed:`, error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          ...(this.props.fill ? { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 } : {}),
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div style={{ maxWidth: 420, padding: 14, borderRadius: 10, background: '#fff4f4', border: '1px solid #f3c2c2', color: '#7a1d1d', fontSize: 12, lineHeight: '17px' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{this.props.label} failed</div>
          <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, wordBreak: 'break-word', marginBottom: 10 }}>{error.message}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => this.setState({ error: null })}
              style={{ height: 26, padding: '0 10px', borderRadius: 6, border: '1px solid #d9a3a3', background: '#fff', color: '#7a1d1d', font: 'inherit', fontWeight: 600, cursor: 'pointer' }}
            >
              Try again
            </button>
            {this.props.actions}
          </div>
        </div>
      </div>
    );
  }
}
