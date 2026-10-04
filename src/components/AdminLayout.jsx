import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userType, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

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
      <nav className="bg-surface-container dark:bg-inverse-surface text-primary dark:text-primary-fixed font-label-caps text-label-caps docked full-height left-0 w-64 border-r border-outline-variant dark:border-outline flat no shadows hidden lg:flex flex-col h-screen fixed left-0 top-0 pt-20 pb-6 z-40">
        <div className="px-6 mb-8">
          <div className="flex items-center justify-between">
            <h1 className="font-headline-lg text-headline-lg-mobile text-primary tracking-widest">LUXE</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary uppercase">
              {userType || 'SUPERADMIN'}
            </span>
          </div>
          <p className="text-on-surface-variant mt-1 text-xs">Management Suite</p>
        </div>

        <div className="flex-1 px-2 space-y-1.5 overflow-y-auto">
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
          <Link to="/admin/model-templates" className={getLinkClass('/admin/model-templates')}>
            <span className="material-symbols-outlined">category</span>
            <span>MODEL TEMPLATES</span>
          </Link>
          <Link to="/admin/settings" className={getLinkClass('/admin/settings')}>
            <span className="material-symbols-outlined">settings</span>
            <span>SETTINGS</span>
          </Link>

          <div className="pt-4 mt-4 border-t border-outline-variant/30 space-y-1">
            <Link to="/studio44" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2 rounded-lg text-xs text-primary font-semibold hover:text-on-background hover:bg-surface-container-highest transition-colors mx-2">
              <span className="material-symbols-outlined text-base">view_in_ar</span>
              <span>STUDIO 4D*4</span>
              <span className="material-symbols-outlined text-xs ml-auto text-secondary">open_in_new</span>
            </Link>
            <Link to="/shop" className="flex items-center gap-3 px-4 py-2 rounded-lg text-xs text-secondary hover:text-on-background transition-colors mx-2">
              <span className="material-symbols-outlined text-base">storefront</span>
              <span>VIEW SHOP</span>
            </Link>
          </div>
        </div>

        <div className="px-6 mt-auto pt-4 border-t border-outline-variant/30 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
              {currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-on-surface text-xs truncate">
                {currentUser?.displayName || 'Superadmin'}
              </p>
              <p className="text-on-surface-variant text-[11px] truncate font-mono">
                {currentUser?.email || 'brandonrobinson81@gmail.com'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2 px-3 rounded bg-surface-variant hover:bg-error/20 hover:text-error text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            <span>SIGN OUT</span>
          </button>
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
