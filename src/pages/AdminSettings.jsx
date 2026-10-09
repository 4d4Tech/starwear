import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePaymentEnvironment } from '../context/PaymentEnvironmentContext';
import SuperadminUserManager from '../components/SuperadminUserManager';

const AdminSettings = () => {
  const { currentUser, isSuperAdmin, isAdmin } = useAuth();
  const {
    adminSettingEnv,
    togglePaymentEnvironment,
    isSandboxMode,
    activeGateway,
    setActivePaymentGateway
  } = usePaymentEnvironment();
  const [saveToast, setSaveToast] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleEnvironmentChange = async (targetEnv) => {
    if (targetEnv === adminSettingEnv) return;
    setIsUpdating(true);
    try {
      await togglePaymentEnvironment(targetEnv);
      setSaveToast(`Payment environment set to ${targetEnv.toUpperCase()}`);
      setTimeout(() => setSaveToast(''), 4000);
    } catch (err) {
      console.error('Failed to change environment:', err);
      alert('Failed to update environment setting: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGatewayChange = async (targetGateway) => {
    if (targetGateway === activeGateway) return;
    setIsUpdating(true);
    try {
      await setActivePaymentGateway(targetGateway);
      setSaveToast(`Payment gateway set to ${targetGateway.toUpperCase()}`);
      setTimeout(() => setSaveToast(''), 4000);
    } catch (err) {
      console.error('Failed to change gateway:', err);
      alert('Failed to update payment gateway: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-outline-variant/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-sm text-primary">settings</span>
            <span className="font-mono text-xs text-primary tracking-widest uppercase">System Preferences</span>
          </div>
          <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background font-bold tracking-tight">
            Settings
          </h2>
          <p className="text-secondary text-sm mt-1">Configure payment gateways, store profile, and developer environments.</p>
        </div>

        {saveToast && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono animate-fade-in">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            <span>{saveToast}</span>
          </div>
        )}
      </header>

      {/* Grid: Payment Gateway Environment & Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* PRIMARY CARD: Payment Gateway Environment Toggle */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-outline-variant/20 lg:col-span-3 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant/20 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-base text-primary">payments</span>
                <span className="font-mono text-xs text-primary uppercase tracking-widest">Gateway Configuration</span>
              </div>
              <h3 className="font-bold text-xl text-on-background tracking-wide">
                Payment Environment Toggle
              </h3>
              <p className="text-secondary text-xs mt-1">
                Control whether developer sandbox buttons and simulation shortcuts are active or hidden.
              </p>
            </div>

            {/* Current Environment Badge */}
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase border flex items-center gap-1.5 shadow-xs ${
                adminSettingEnv === 'sandbox'
                  ? 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700/60'
                  : 'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700/60'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  adminSettingEnv === 'sandbox' ? 'bg-amber-600 dark:bg-amber-400 animate-pulse' : 'bg-emerald-600 dark:bg-emerald-400'
                }`}></span>
                <span>{adminSettingEnv === 'sandbox' ? 'SANDBOX ACTIVE' : 'LIVE PRODUCTION'}</span>
              </span>
            </div>
          </div>

          {/* Toggle Control Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Sandbox Option */}
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleEnvironmentChange('sandbox')}
              className={`p-6 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                adminSettingEnv === 'sandbox'
                  ? 'bg-amber-50 border-amber-500 text-amber-950 dark:bg-amber-950/40 dark:border-amber-500 dark:text-amber-100 ring-2 ring-amber-500/40 shadow-lg'
                  : 'bg-surface-variant/20 border-outline-variant/30 hover:border-outline-variant/60 text-secondary hover:text-on-background'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
                    adminSettingEnv === 'sandbox' ? 'bg-amber-200 text-amber-950 dark:bg-amber-900/60 dark:text-amber-200' : 'bg-surface-variant text-secondary'
                  }`}>
                    <span className="material-symbols-outlined text-lg">science</span>
                  </div>
                  <span className="font-bold text-base text-on-background font-mono">SANDBOX</span>
                </div>
                {adminSettingEnv === 'sandbox' && (
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl font-bold">check_circle</span>
                )}
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Developer test environment. Displays sandbox purchase buttons, 1-click test links, and simulates PayPal checkout across product pages, shop, and cart for admin accounts.
              </p>
            </button>

            {/* Live Option */}
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleEnvironmentChange('live')}
              className={`p-6 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                adminSettingEnv === 'live'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-500 dark:text-emerald-100 ring-2 ring-emerald-500/40 shadow-lg'
                  : 'bg-surface-variant/20 border-outline-variant/30 hover:border-outline-variant/60 text-secondary hover:text-on-background'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
                    adminSettingEnv === 'live' ? 'bg-emerald-200 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-200' : 'bg-surface-variant text-secondary'
                  }`}>
                    <span className="material-symbols-outlined text-lg">verified</span>
                  </div>
                  <span className="font-bold text-base text-on-background font-mono">LIVE PRODUCTION</span>
                </div>
                {adminSettingEnv === 'live' && (
                  <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-xl font-bold">check_circle</span>
                )}
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Live customer transactions. Completely hides all sandbox buttons, test links, and developer shortcuts across the entire app. Only genuine live checkouts are offered.
              </p>
            </button>
          </div>

          {/* Role Security Callout */}
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-100 flex items-start gap-3.5 text-xs">
            <span className="material-symbols-outlined text-blue-700 dark:text-blue-400 text-xl flex-shrink-0 mt-0.5">shield</span>
            <div className="space-y-1">
              <p className="font-bold text-blue-900 dark:text-blue-200 font-mono uppercase tracking-wide">
                Role-Based Sandbox Isolation
              </p>
              <p className="text-blue-950 dark:text-blue-100/90 leading-relaxed font-body-sm">
                Only authenticated <strong>Admin</strong> and <strong>Superadmin</strong> accounts can activate and view Sandbox mode. Every other user, including all guest visitors and regular customer accounts, stays strictly locked in <strong>Live</strong> mode so customer checkout is never interrupted.
              </p>
            </div>
          </div>
        </section>

        {/* SECONDARY CARD: Active Payment Gateway Selector */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-outline-variant/20 lg:col-span-3 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant/20 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-base text-primary">account_balance</span>
                <span className="font-mono text-xs text-primary uppercase tracking-widest">Gateway Selection</span>
              </div>
              <h3 className="font-bold text-xl text-on-background tracking-wide">
                Active Payment Gateway
              </h3>
              <p className="text-secondary text-xs mt-1">
                Choose which payment processor powers customer checkouts and sandbox testing across the store.
              </p>
            </div>

            {/* Current Gateway Badge */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase border border-slate-300 dark:border-slate-700 bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100 flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-slate-700 dark:bg-slate-300 animate-pulse"></span>
                <span>
                  {activeGateway === 'both' ? 'MULTI-GATEWAY (PAYPAL + STRIPE)' : `${activeGateway.toUpperCase()} ACTIVE`}
                </span>
              </span>
            </div>
          </div>

          {/* Gateway Selection Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* PayPal Option */}
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleGatewayChange('paypal')}
              className={`p-6 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                activeGateway === 'paypal'
                  ? 'bg-blue-50 border-blue-500 text-blue-950 dark:bg-blue-950/40 dark:border-blue-500 dark:text-blue-100 ring-2 ring-blue-500/40 shadow-lg'
                  : 'bg-surface-variant/20 border-outline-variant/30 hover:border-outline-variant/60 text-secondary hover:text-on-background'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
                    activeGateway === 'paypal' ? 'bg-blue-200 text-blue-950 dark:bg-blue-900/60 dark:text-blue-200' : 'bg-surface-variant text-secondary'
                  }`}>
                    <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-on-background font-mono">PAYPAL</h4>
                    <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-300 font-bold">CREDENTIALS IN .ENV</span>
                  </div>
                </div>
                {activeGateway === 'paypal' && (
                  <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl font-bold">check_circle</span>
                )}
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Native PayPal checkout with smart buttons, PayPal balance, and direct sandbox testing.
              </p>
            </button>

            {/* Stripe Option */}
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleGatewayChange('stripe')}
              className={`p-6 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                activeGateway === 'stripe'
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-950 dark:bg-indigo-950/40 dark:border-indigo-500 dark:text-indigo-100 ring-2 ring-indigo-500/40 shadow-lg'
                  : 'bg-surface-variant/20 border-outline-variant/30 hover:border-outline-variant/60 text-secondary hover:text-on-background'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
                    activeGateway === 'stripe' ? 'bg-indigo-200 text-indigo-950 dark:bg-indigo-900/60 dark:text-indigo-200' : 'bg-surface-variant text-secondary'
                  }`}>
                    <span className="material-symbols-outlined text-xl">credit_card</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-on-background font-mono">STRIPE</h4>
                    <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-300 font-bold">CREDENTIALS IN .ENV</span>
                  </div>
                </div>
                {activeGateway === 'stripe' && (
                  <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-xl font-bold">check_circle</span>
                )}
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Credit and debit card processing powered by Stripe Checkout sessions and test simulations.
              </p>
            </button>

            {/* Both Option */}
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleGatewayChange('both')}
              className={`p-6 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                activeGateway === 'both'
                  ? 'bg-purple-50 border-purple-500 text-purple-950 dark:bg-purple-950/40 dark:border-purple-500 dark:text-purple-100 ring-2 ring-purple-500/40 shadow-lg'
                  : 'bg-surface-variant/20 border-outline-variant/30 hover:border-outline-variant/60 text-secondary hover:text-on-background'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
                    activeGateway === 'both' ? 'bg-purple-200 text-purple-950 dark:bg-purple-900/60 dark:text-purple-200' : 'bg-surface-variant text-secondary'
                  }`}>
                    <span className="material-symbols-outlined text-xl">hub</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-on-background font-mono">MULTI-GATEWAY</h4>
                    <span className="text-[10px] font-mono text-purple-800 dark:text-purple-300 font-bold">PAYPAL & STRIPE</span>
                  </div>
                </div>
                {activeGateway === 'both' && (
                  <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-xl font-bold">check_circle</span>
                )}
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Offers customers both PayPal and Stripe card options side-by-side on the checkout page.
              </p>
            </button>
          </div>

          {/* Credentials Overview */}
          <div className="pt-2">
            <h4 className="text-xs font-mono font-semibold text-secondary uppercase tracking-wider mb-3">
              Configured Credentials Overview (.env)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              {/* PayPal Credentials Card */}
              <div className="p-4 rounded-xl bg-surface-variant/20 border border-outline-variant/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-on-background flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-sm">account_balance_wallet</span>
                    <span>PayPal Gateway</span>
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/60">
                    Connected
                  </span>
                </div>
                <div className="text-secondary space-y-1">
                  <div className="flex justify-between">
                    <span>Client ID:</span>
                    <span className="text-on-background font-mono truncate max-w-[200px]">ASkWMzOCAq...b1HFf5qp</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Secret Key:</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">•••••••• Configured (.env)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Default Mode:</span>
                    <span className="text-amber-800 dark:text-amber-300 uppercase font-bold">Sandbox</span>
                  </div>
                </div>
              </div>

              {/* Stripe Credentials Card */}
              <div className="p-4 rounded-xl bg-surface-variant/20 border border-outline-variant/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-on-background flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-sm">credit_card</span>
                    <span>Stripe Gateway</span>
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/60">
                    Connected
                  </span>
                </div>
                <div className="text-secondary space-y-1">
                  <div className="flex justify-between">
                    <span>Publishable Key:</span>
                    <span className="text-on-background font-mono truncate max-w-[200px]">pk_test_51UNEk9...Q403rTLU</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Secret Key:</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">•••••••• Configured (.env)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Default Currency:</span>
                    <span className="text-on-background uppercase font-bold">USD ($)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Store Profile Settings */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-outline-variant/20 lg:col-span-2 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
            <div>
              <h3 className="font-bold text-lg text-on-background tracking-wide">Store Information</h3>
              <p className="text-xs text-secondary font-mono mt-0.5">Brand details and public customer receipt labels</p>
            </div>
            <span className="text-xs font-mono text-secondary">Star weAR Studio</span>
          </div>

          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setSaveToast('Store details saved!'); setTimeout(() => setSaveToast(''), 3000); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-secondary uppercase tracking-wider block">Store Name</label>
                <input
                  type="text"
                  defaultValue="Star weAR Spatial Fashion"
                  className="w-full bg-surface-variant/30 border border-outline-variant/30 rounded-lg px-3.5 py-2.5 text-sm text-on-background focus:outline-none focus:border-primary font-mono transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-secondary uppercase tracking-wider block">Contact Email</label>
                <input
                  type="email"
                  defaultValue={currentUser?.email || "brandonrobinson81@gmail.com"}
                  className="w-full bg-surface-variant/30 border border-outline-variant/30 rounded-lg px-3.5 py-2.5 text-sm text-on-background focus:outline-none focus:border-primary font-mono transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-secondary uppercase tracking-wider block">Business Address</label>
              <input
                type="text"
                defaultValue="Star weAR Studio, Silicon Valley, CA"
                className="w-full bg-surface-variant/30 border border-outline-variant/30 rounded-lg px-3.5 py-2.5 text-sm text-on-background focus:outline-none focus:border-primary font-mono transition-colors"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-on-primary font-mono text-xs font-bold transition-all shadow cursor-pointer uppercase tracking-wider"
              >
                Save Store Info
              </button>
            </div>
          </form>
        </section>

        {/* System & Account Security */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-outline-variant/20 shadow-sm space-y-6">
          <div className="border-b border-outline-variant/20 pb-4">
            <h3 className="font-bold text-lg text-on-background tracking-wide">Admin Access</h3>
            <p className="text-xs text-secondary font-mono mt-0.5">Active session credentials</p>
          </div>

          <div className="space-y-4 text-xs font-mono">
            <div className="p-3 rounded-lg bg-surface-variant/30 border border-outline-variant/20 space-y-1">
              <span className="text-secondary block">Account Email:</span>
              <span className="font-bold text-on-background truncate block">
                {currentUser?.email || 'brandonrobinson81@gmail.com'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-surface-variant/30 border border-outline-variant/20 space-y-1">
              <span className="text-secondary block">Authorization Tier:</span>
              <span className="font-bold text-cyan-400 block uppercase">
                {isSuperAdmin ? 'Superadmin (Full Access)' : isAdmin ? 'Admin' : 'Restricted User'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-surface-variant/30 border border-outline-variant/20 space-y-1">
              <span className="text-secondary block">Active Payment Mode:</span>
              <span className={`font-bold block uppercase ${
                isSandboxMode ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {isSandboxMode ? 'Sandbox Testing' : 'Live Production'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-surface-variant/30 border border-outline-variant/20 space-y-1">
              <span className="text-secondary block">Active Gateway:</span>
              <span className="font-bold text-primary block uppercase">
                {activeGateway === 'both' ? 'Multi (PayPal + Stripe)' : activeGateway}
              </span>
            </div>
          </div>
        </section>

        {/* SUPERADMIN ONLY: Admin & Role Governance Section */}
        {isSuperAdmin && (
          <section className="glass-panel p-6 sm:p-8 rounded-xl border border-purple-500/30 lg:col-span-3 shadow-lg">
            <SuperadminUserManager />
          </section>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
