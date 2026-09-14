import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { login, logout, currentUser, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine redirect URL after successful login
  const searchParams = new URLSearchParams(location.search);
  const redirectPath = searchParams.get('redirect') || '/admin/dashboard';

  // If already logged in as superadmin, redirect directly
  React.useEffect(() => {
    if (currentUser && isSuperAdmin) {
      navigate(redirectPath, { replace: true });
    }
  }, [currentUser, isSuperAdmin, navigate, redirectPath]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSubmitting(true);

    try {
      const result = await login(email.trim(), password);
      if (result.isSuperAdmin) {
        navigate(redirectPath, { replace: true });
      } else {
        // Authenticated, but not superadmin
        await logout();
        setErrorMessage('Access Denied: This account does not possess Superadmin privileges.');
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setErrorMessage('Invalid email or password. Please verify your superadmin credentials.');
      } else if (err.code === 'auth/too-many-requests') {
        setErrorMessage('Too many failed attempts. Please wait a moment and try again.');
      } else {
        setErrorMessage(err.message || 'Failed to authenticate. Please check your credentials.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickFill = () => {
    setEmail('brandonrobinson81@gmail.com');
    setPassword('brandonrobinson81!');
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col justify-between p-6 sm:p-12 relative overflow-hidden font-sans select-none">
      {/* Background glow ambiance */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[#2997ff]/15 via-[#a855f7]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] pointer-events-none" />

      {/* Top Bar */}
      <header className="relative z-10 flex justify-between items-center max-w-5xl w-full mx-auto">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="font-extrabold tracking-widest text-lg text-white">STAR <span className="font-light text-[#2997ff]">weAR</span></span>
          <span className="text-xs text-[#71717a] font-mono tracking-wider">• SUITE</span>
        </Link>
        <Link 
          to="/"
          className="text-xs text-[#a1a1aa] hover:text-white transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          <span>Back to Storefront</span>
        </Link>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-[#121214]/90 backdrop-blur-2xl border border-white/[0.12] rounded-3xl p-8 sm:p-10 shadow-[0_30px_90px_rgba(0,0,0,0.9)] space-y-8">
          
          {/* Header */}
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.1] text-[11px] font-semibold tracking-wider text-[#38bdf8] uppercase">
              <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-pulse"></span>
              RESTRICTED ACCESS
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Admin Suite
            </h1>
            <p className="text-xs text-[#a1a1aa] max-w-xs mx-auto">
              Sign in with your verified superadmin credentials to manage inventory, catalog & analytics.
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#a1a1aa] tracking-wide block uppercase">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#1c1c20] border border-white/[0.12] focus:border-[#2997ff] rounded-xl px-4 py-3 text-sm text-white placeholder-[#52525b] outline-none transition-all"
                />
                <span className="material-symbols-outlined absolute right-3.5 top-3 text-[#52525b] text-lg pointer-events-none">
                  mail
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-[#a1a1aa] tracking-wide block uppercase">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#1c1c20] border border-white/[0.12] focus:border-[#2997ff] rounded-xl px-4 py-3 text-sm text-white placeholder-[#52525b] outline-none transition-all pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-[#71717a] hover:text-white transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[#2997ff] hover:bg-[#0077ed] text-white font-semibold text-sm transition-all shadow-lg shadow-[#2997ff]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In as Superadmin</span>
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          {/* Quick-Fill Helper for convenience */}
          <div className="pt-4 border-t border-white/[0.08] text-center space-y-2">
            <button
              type="button"
              onClick={handleQuickFill}
              className="text-xs text-[#71717a] hover:text-[#38bdf8] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">key</span>
              <span>Fill Superadmin Credentials</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center text-[11px] text-[#52525b] space-y-1 max-w-5xl mx-auto w-full">
        <p>© 2026 Star weAR Inc. All rights reserved.</p>
        <p>Protected by Firebase Authentication & Role-Based Access Control.</p>
      </footer>
    </div>
  );
}
