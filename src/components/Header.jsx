import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const location = useLocation();
  const { getCartCount } = useCart();
  const { isAdmin, isSuperAdmin, canAccessStudio } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isBumping, setIsBumping] = useState(false);

  const cartCount = getCartCount();
  const isCartActive = location.pathname === '/cart';

  // Pop animation whenever cart item count changes and is > 0
  useEffect(() => {
    if (cartCount > 0) {
      setIsBumping(true);
      const timer = setTimeout(() => setIsBumping(false), 350);
      return () => clearTimeout(timer);
    }
  }, [cartCount]);

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

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Only Authenticated Admins & Superadmins See Admin Links */}
          {(isAdmin || isSuperAdmin) && (
            <Link 
              to="/admin/dashboard" 
              className="px-3 py-1.5 rounded-full border border-primary/50 bg-primary/10 text-primary text-[11px] font-bold tracking-wider hover:bg-primary hover:text-white transition-all flex items-center gap-1 shadow-sm"
              title="Admin Management Suite"
            >
              <span className="material-symbols-outlined text-sm">shield_person</span>
              <span>ADMIN</span>
            </Link>
          )}

          {/* Modern Capsule Cart Button */}
          <Link
            to="/cart"
            aria-label={`Shopping Cart with ${cartCount} item${cartCount === 1 ? '' : 's'}`}
            title={`Shopping Cart (${cartCount} items)`}
            className={`group relative flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full border transition-all duration-300 active:scale-95 cursor-pointer shadow-xs ${
              isCartActive
                ? 'border-primary bg-primary/15 text-primary shadow-[0_0_15px_rgba(82,99,115,0.25)]'
                : isBumping
                ? 'border-primary ring-2 ring-primary/30 scale-105 bg-primary/10 text-primary'
                : 'border-on-background/15 hover:border-primary/50 bg-on-background/[0.04] hover:bg-on-background/[0.08] hover:shadow-[0_4px_18px_rgba(82,99,115,0.15)] text-on-background'
            }`}
          >
            {/* Shopping Bag Icon with micro-interaction */}
            <div className="relative flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] sm:text-[19px] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                shopping_bag
              </span>
              {/* Pulsing indicator when cart has active items */}
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse" />
              )}
            </div>

            {/* Responsive Text Label */}
            <span className="hidden sm:inline font-mono text-[11px] font-bold tracking-widest uppercase transition-colors">
              CART
            </span>

            {/* Dynamic Counter Chip */}
            <span
              className={`font-mono text-[10px] sm:text-[11px] font-bold rounded-full flex items-center justify-center transition-all duration-300 ${
                cartCount > 0
                  ? 'bg-primary text-white px-2 py-0.5 min-w-[20px] h-5 shadow-[0_2px_8px_rgba(82,99,115,0.35)]'
                  : 'bg-on-background/10 text-on-background/50 px-1.5 py-0.5 min-w-[18px] h-4.5'
              } ${isBumping ? 'scale-125' : 'scale-100'}`}
            >
              {cartCount}
            </span>
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
            <Link className={getMobileLinkClasses('/cart')} to="/cart">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">shopping_bag</span>
                <span>CART</span>
              </div>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                cartCount > 0 ? 'bg-primary text-white' : 'bg-on-background/10 text-on-background/60'
              }`}>
                {cartCount}
              </span>
            </Link>
            {canAccessStudio && (
              <Link className={getMobileLinkClasses('/studio4d4')} to="/studio4d4">
                <span>STUDIO 4D4 (3D)</span>
                <span className="material-symbols-outlined text-xs">view_in_ar</span>
              </Link>
            )}

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

