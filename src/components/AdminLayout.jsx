import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const AdminLayout = () => {
  const location = useLocation();

  const getLinkClass = (path) => {
    const isActive = location.pathname.includes(path);
    return `flex items-center gap-3 px-4 py-3 rounded-lg transition-transform mx-2 my-1 ${
      isActive 
        ? 'bg-primary text-on-primary' 
        : 'text-on-surface-variant hover:bg-surface-container-highest transition-colors'
    }`;
  };

  return (
    <div className="bg-background text-on-background font-body-md antialiased min-h-screen flex">
      {/* SideNavBar */}
      <nav className="bg-surface-container dark:bg-inverse-surface text-primary dark:text-primary-fixed font-label-caps text-label-caps docked full-height left-0 w-64 border-r border-outline-variant dark:border-outline flat no shadows hidden lg:flex flex-col h-screen fixed left-0 top-0 pt-24 pb-8 z-40">
        <div className="px-6 mb-12">
          <h1 className="font-headline-lg text-headline-lg-mobile text-primary tracking-widest">LUXE</h1>
          <p className="text-on-surface-variant mt-2">Management Suite</p>
        </div>
        <div className="flex-1 px-2 space-y-2">
          <Link to="/admin/dashboard" className={getLinkClass('/admin/dashboard')}>
            <span className="material-symbols-outlined">dashboard</span>
            <span>DASHBOARD</span>
          </Link>
          <Link to="/admin/inventory" className={getLinkClass('/admin/inventory')}>
            <span className="material-symbols-outlined">inventory_2</span>
            <span>INVENTORY</span>
          </Link>
          <Link to="/admin/orders" className={getLinkClass('/admin/orders')}>
            <span className="material-symbols-outlined">shopping_cart</span>
            <span>ORDERS</span>
          </Link>
          <Link to="/admin/analytics" className={getLinkClass('/admin/analytics')}>
            <span className="material-symbols-outlined">insights</span>
            <span>ANALYTICS</span>
          </Link>
          <Link to="/admin/settings" className={getLinkClass('/admin/settings')}>
            <span className="material-symbols-outlined">settings</span>
            <span>SETTINGS</span>
          </Link>
        </div>
        <div className="px-6 mt-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant">person</span>
            </div>
            <div>
              <p className="font-bold text-on-surface">Admin User</p>
              <p className="text-on-surface-variant text-xs">admin@luxe.com</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 p-margin-mobile md:p-margin-desktop min-h-screen pb-32">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
