import React from 'react';
import SuperadminUserManager from '../components/SuperadminUserManager';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function AdminTeam() {
  const { isSuperAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-secondary font-mono text-xs">
        <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
        Verifying Superadmin Authority...
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="space-y-8 pb-16">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-outline-variant/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-sm text-purple-400">shield_person</span>
            <span className="font-mono text-xs text-purple-400 tracking-widest uppercase">
              Superadmin Governance
            </span>
          </div>
          <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background font-bold tracking-tight">
            Team & Role Authority
          </h2>
          <p className="text-secondary text-sm mt-1">
            Configure administrative accounts, assign roles, and manage Studio 4D4 spatial access.
          </p>
        </div>
      </header>

      <section className="glass-panel p-6 sm:p-8 rounded-xl border border-purple-500/30 shadow-md">
        <SuperadminUserManager />
      </section>
    </div>
  );
}
