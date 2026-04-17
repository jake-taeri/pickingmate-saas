import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100dvh', padding: '32px 24px', background: '#0f172a', textAlign: 'center',
      }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', marginBottom: 10 }}>
          앱에서 문제가 발생했습니다
        </div>
        <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 32, lineHeight: 1.6 }}>
          새로고침 버튼을 눌러주세요.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 32px', borderRadius: 12, border: 'none',
            background: '#3b82f6', color: '#fff', fontSize: 16, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          새로고침
        </button>
        {process.env.NODE_ENV === 'development' && (
          <pre style={{
            marginTop: 32, padding: 16, background: '#1e293b', borderRadius: 8,
            fontSize: 11, color: '#f87171', textAlign: 'left',
            maxWidth: 480, overflow: 'auto', whiteSpace: 'pre-wrap',
          }}>
            {this.state.error.message}
          </pre>
        )}
      </div>
    );
  }
}
