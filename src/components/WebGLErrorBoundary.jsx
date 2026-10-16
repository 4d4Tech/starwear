/* eslint-disable react/prop-types */
import React from 'react';

/**
 * Catches WebGL context initialization or runtime errors (e.g. browser context loss,
 * disabled graphics acceleration) and prevents React Three Fiber from unmounting the whole app.
 */
export default class WebGLErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[WebGLErrorBoundary] WebGL rendering error intercepted:', error, errorInfo);
    if (typeof this.props.onError === 'function') {
      try {
        this.props.onError(error);
      } catch (e) {
        console.warn('[WebGLErrorBoundary] Error in onError callback:', e);
      }
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, retry: this.handleRetry })
          : this.props.fallback;
      }

      return (
        <div className="w-full h-full min-h-[280px] flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 backdrop-blur-md rounded-2xl border border-white/10 select-none">
          <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-3 text-cyan-400 shadow-md">
            <span className="material-symbols-outlined text-2xl">view_in_ar</span>
          </div>
          <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-1.5 font-mono">
            3D Graphics Context Paused
          </h4>
          <p className="text-xs text-neutral-400 max-w-xs mb-4 leading-relaxed font-mono">
            Your browser temporarily paused WebGL graphics resources. Click below to retry.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:opacity-95 text-white font-mono text-xs font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span>Retry 3D Viewer</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
