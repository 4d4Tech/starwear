import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export default function Header() {
  const location = useLocation();
  const { getCartCount } = useCart();

  const getLinkClasses = (path) => {
    const isActive = location.pathname === path;
    return isActive
      ? "text-primary border-b border-primary pb-1 transition-all duration-200"
      : "nav-bracket hover:text-primary transition-colors hover:opacity-70 duration-300";
  };

  return (
    <nav className="fixed top-0 w-full flex justify-between items-center px-margin-mobile md:px-margin-desktop h-20 bg-transparent backdrop-blur-md z-50 border-b border-on-background/10 text-on-background font-label-caps text-label-caps">
      <div className="flex items-center gap-8 hidden md:flex">
        <Link className={getLinkClasses('/')} to="/">HOME</Link>
        <Link className={getLinkClasses('/collections')} to="/collections">COLLECTIONS</Link>
        <Link className={getLinkClasses('/product')} to="/product">SHOP</Link>
        <Link className={getLinkClasses('/about')} to="/about">ABOUT</Link>
        <Link className={getLinkClasses('/contact')} to="/contact">CONTACT</Link>
      </div>
      
      {/* Mobile Menu Trigger */}
      <button className="md:hidden flex items-center p-2">
        <span className="material-symbols-outlined text-[24px]">menu</span>
      </button>

      {/* Brand Title (Center for mobile, hidden on desktop for now as layout splits it) */}
      <div className="font-headline-lg font-bold text-xl tracking-widest text-on-background md:hidden">
        STAR <span className="text-primary font-light">weAR</span>
      </div>

      <div className="flex items-center gap-4">
        <Link to="/cart" aria-label="shopping_bag" className="p-2 hover:opacity-70 transition-opacity duration-300 relative group flex items-center gap-2">
          <span className="nav-bracket group-hover:text-primary">[ Cart: {getCartCount()} ]</span>
        </Link>
      </div>
    </nav>
  );
}

