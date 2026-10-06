import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const location = useLocation();
  const { getCartCount } = useCart();
  const { isAdmin, isSuperAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu whenever location changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const getLinkClasses = (path) => {
    const isActive = location.pathname === path || (path === '/shop' && (location.pathname === '/product' || location.pathname.startsWith('/product/')));
    return isActive
      ? "text-primary border-b border-primary pb-1 transition-all duration-200 font-bold"
      : "nav-bracket hover:text-primary transition-colors hover:opacity-70 duration-300";
  };

  const getMobileLinkClasses = (path) => {
    const isActive = location.pathname === path || (path === '/shop' && (location.pathname === '/product' || location.pathname.startsWith('/product/')));
    return isActive
      ? "text-primary font-bold bg-primary/10 px-4 py-2.5 rounded-xl border border-primary/20 flex items-center justify-between"
      : "text-on-background/80 hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 px-4 py-2.5 rounded-xl transition-colors flex items-center justify-between";
  };

  return (
    <>
      <nav className="fixed top-0 w-full flex justify-between items-center px-margin-mobile md:px-margin-desktop h-20 bg-background/80 backdrop-blur-md z-50 border-b border-on-background/10 text-on-background font-label-caps text-label-caps">
        <div className="flex items-center gap-8 hidden md:flex">
          <Link className={getLinkClasses('/')} to="/">HOME</Link>
          <Link className={getLinkClasses('/collections')} to="/collections">COLLECTIONS</Link>
          <Link className={getLinkClasses('/shop')} to="/shop">SHOP</Link>
          <Link className={getLinkClasses('/about')} to="/about">ABOUT</Link>
          <Link className={getLinkClasses('/contact')} to="/contact">CONTACT</Link>
        </div>
        
        {/* Mobile Menu Trigger */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden flex items-center p-2 text-on-background hover:text-primary transition-colors cursor-pointer" 
          aria-label="Toggle mobile menu"
        >
          <span className="material-symbols-outlined text-[26px]">
            {mobileMenuOpen ? 'close' : 'menu'}
          </span>
        </button>

        {/* Brand Title */}
        <Link to="/" className="font-headline-lg font-bold text-xl tracking-widest text-on-background md:hidden">
          STAR <span className="text-primary font-light">weAR</span>
        </Link>

        <div className="flex items-center gap-4">
          {/* Only Authenticated Admins & Superadmins See Admin Links */}
          {(isAdmin || isSuperAdmin) && (
            <Link 
              to="/admin/dashboard" 
              className="px-3 py-1 rounded-full border border-primary/50 bg-primary/10 text-primary text-[11px] font-bold tracking-wider hover:bg-primary hover:text-black transition-all flex items-center gap-1 shadow-sm"
              title="Admin Management Suite"
            >
              <span className="material-symbols-outlined text-sm">shield_person</span>
              <span>ADMIN</span>
            </Link>
          )}

          <Link to="/cart" aria-label="shopping_bag" className="p-2 hover:opacity-70 transition-opacity duration-300 relative group flex items-center gap-2">
            <span className="nav-bracket group-hover:text-primary">[ Cart: {getCartCount()} ]</span>
          </Link>
        </div>
      </nav>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-20 z-40 bg-black/70 backdrop-blur-xl md:hidden flex flex-col p-6 animate-in fade-in duration-200">
          <div className="bg-background/95 border border-outline-variant/30 rounded-2xl p-6 shadow-2xl flex flex-col gap-3 font-label-caps text-sm tracking-wider">
            <Link className={getMobileLinkClasses('/')} to="/">
              <span>HOME</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </Link>
            <Link className={getMobileLinkClasses('/collections')} to="/collections">
              <span>COLLECTIONS</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </Link>
            <Link className={getMobileLinkClasses('/shop')} to="/shop">
              <span>SHOP</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </Link>
            <Link className={getMobileLinkClasses('/about')} to="/about">
              <span>ABOUT</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </Link>
            <Link className={getMobileLinkClasses('/contact')} to="/contact">
              <span>CONTACT</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </Link>
            <Link className={getMobileLinkClasses('/studio4d4')} to="/studio4d4">
              <span>STUDIO 4D4 (3D)</span>
              <span className="material-symbols-outlined text-xs">view_in_ar</span>
            </Link>

            <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-between text-xs text-secondary font-mono">
              <span>SPATIAL LUXURY</span>
              <span className="text-primary font-bold">WEBAR READY</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

