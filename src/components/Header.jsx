import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const location = useLocation();
  const { getCartCount } = useCart();
  const { isSuperAdmin } = useAuth();

  const getLinkClasses = (path) => {
    const isActive = location.pathname === path || (path === '/shop' && (location.pathname === '/product' || location.pathname.startsWith('/product/')));
    return isActive
      ? "text-primary border-b border-primary pb-1 transition-all duration-200 font-bold"
      : "nav-bracket hover:text-primary transition-colors hover:opacity-70 duration-300";
  };

  return (
    <nav className="fixed top-0 w-full flex justify-between items-center px-margin-mobile md:px-margin-desktop h-20 bg-transparent backdrop-blur-md z-50 border-b border-on-background/10 text-on-background font-label-caps text-label-caps">
      <div className="flex items-center gap-8 hidden md:flex">
        <Link className={getLinkClasses('/')} to="/">HOME</Link>
        <Link className={getLinkClasses('/collections')} to="/collections">COLLECTIONS</Link>
        <Link className={getLinkClasses('/shop')} to="/shop">SHOP</Link>
        <Link className={getLinkClasses('/about')} to="/about">ABOUT</Link>
        <Link className={getLinkClasses('/contact')} to="/contact">CONTACT</Link>
      </div>
      
      {/* Mobile Menu Trigger */}
      <button className="md:hidden flex items-center p-2" aria-label="Open menu">
        <span className="material-symbols-outlined text-[24px]">menu</span>
      </button>

      {/* Brand Title */}
      <Link to="/" className="font-headline-lg font-bold text-xl tracking-widest text-on-background md:hidden">
        STAR <span className="text-primary font-light">weAR</span>
      </Link>

      <div className="flex items-center gap-4">
        {/* Only Authenticated Superadmins See Admin Links */}
        {isSuperAdmin && (
          <Link 
            to="/admin/dashboard" 
            className="px-3 py-1 rounded-full border border-primary/50 bg-primary/10 text-primary text-[11px] font-bold tracking-wider hover:bg-primary hover:text-black transition-all flex items-center gap-1 shadow-sm"
            title="Superadmin Management Suite"
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
  );
}

