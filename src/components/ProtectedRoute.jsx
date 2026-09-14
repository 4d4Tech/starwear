import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { currentUser, isSuperAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-10 h-10 border-2 border-white/20 border-t-[#2997ff] rounded-full animate-spin"></div>
        <p className="text-xs uppercase tracking-widest text-[#a1a1aa] font-mono">
          Verifying Authorization...
        </p>
      </div>
    );
  }

  // Only authenticated users with superadmin role are granted access to admin views
  if (!currentUser || !isSuperAdmin) {
    return (
      <Navigate 
        to={`/admin/login?redirect=${encodeURIComponent(location.pathname)}`} 
        replace 
      />
    );
  }

  return <Outlet />;
}
