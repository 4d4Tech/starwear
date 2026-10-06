import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Footer() {
  const { isAdmin, isSuperAdmin, canAccessStudio } = useAuth();
  const { getCartCount } = useCart();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setSubscribed(true);
    setTimeout(() => {
      setEmail('');
      setSubscribed(false);
    }, 4000);
  };

  return (
    <footer className="w-full bg-[#0a0a0c] text-[#86868b] border-t border-white/[0.08] relative z-20 font-body-md">
      {/* Upper Grid */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
          
          {/* Brand & Manifesto Column (2 cols wide on desktop) */}
          <div className="lg:col-span-2 space-y-6">
            <Link to="/" className="inline-block font-headline-lg text-2xl font-bold tracking-widest text-white uppercase hover:opacity-90 transition-opacity">
              STAR <span className="text-[#38bdf8] font-light">weAR</span>
            </Link>
            <p className="text-sm text-[#a1a1aa] leading-relaxed max-w-sm">
              The premier phygital atelier where luxury heavyweight streetwear meets real-time WebAR spatial computing. Engineered in Los Angeles, California. Powered by 4D4 Technologies.
            </p>

            {/* Newsletter Subscription */}
            <div className="space-y-3 pt-2">
              <span className="text-[11px] font-mono tracking-widest text-[#a1a1aa] uppercase block">
                Join The Spatial Collective
              </span>
              <p className="text-xs text-[#71717a]">
                Receive private drop alerts, 1-of-1 capsule releases, and WebAR shader updates.
              </p>
              {subscribed ? (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-emerald-400">mark_email_read</span>
                  <span>Transmission confirmed. You are on the private access roster.</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2 max-w-md">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address..."
                    required
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.12] focus:border-[#38bdf8] text-white text-xs placeholder-[#52525b] outline-none transition-colors font-mono"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-white text-black hover:bg-[#38bdf8] hover:text-black text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-md cursor-pointer flex-shrink-0"
                  >
                    Join
                  </button>
                </form>
              )}
            </div>

            {/* Live Operational Status */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-[#a1a1aa]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>WebAR Optical Engine: Online • v2.4</span>
            </div>
          </div>

          {/* Column 1: Atelier */}
          <div className="space-y-4">
            <h4 className="text-xs font-mono uppercase tracking-widest text-white font-bold">
              Atelier
            </h4>
            <ul className="space-y-2.5 text-xs text-[#a1a1aa]">
              <li>
                <Link to="/" className="hover:text-white transition-colors">Storefront</Link>
              </li>
              <li>
                <Link to="/collections" className="hover:text-white transition-colors">Curated Collections</Link>
              </li>
              <li>
                <Link to="/shop" className="hover:text-white transition-colors">All Garments</Link>
              </li>
              {canAccessStudio && (
                <li>
                  <Link to="/studio4d4" className="hover:text-white transition-colors">Studio 4D4 3D Rigging</Link>
                </li>
              )}
              <li>
                <Link to="/cart" className="hover:text-white transition-colors">Bag ({getCartCount()})</Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Information */}
          <div className="space-y-4">
            <h4 className="text-xs font-mono uppercase tracking-widest text-white font-bold">
              Company
            </h4>
            <ul className="space-y-2.5 text-xs text-[#a1a1aa]">
              <li>
                <Link to="/about" className="hover:text-white transition-colors">About Star weAR</Link>
              </li>
              <li>
                <Link to="/about#technology" className="hover:text-white transition-colors">WebAR Technology</Link>
              </li>
              <li>
                <Link to="/about#craftsmanship" className="hover:text-white transition-colors">Fabric Craftsmanship</Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">Concierge & Contact</Link>
              </li>
              <li>
                <Link to="/contact#faq" className="hover:text-white transition-colors">Help & Sizing FAQs</Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Concierge & Direct Channels */}
          <div className="space-y-4">
            <h4 className="text-xs font-mono uppercase tracking-widest text-white font-bold">
              Concierge
            </h4>
            <div className="space-y-3 text-xs text-[#a1a1aa]">
              <div>
                <span className="text-[10px] font-mono text-[#71717a] block uppercase">Customer Care</span>
                <a href="mailto:concierge@ttl44.com" className="text-white hover:text-[#38bdf8] transition-colors font-mono text-xs">
                  concierge@ttl44.com
                </a>
              </div>
              <div>
                <span className="text-[10px] font-mono text-[#71717a] block uppercase">Custom AR Drops</span>
                <a href="mailto:studios@4d4.tech" className="text-white hover:text-[#38bdf8] transition-colors font-mono text-xs">
                  studios@4d4.tech
                </a>
              </div>
              <div>
                <span className="text-[10px] font-mono text-[#71717a] block uppercase">Spatial Lab</span>
                <span className="text-[#d4d4d8] text-xs">Los Angeles, CA / Global</span>
              </div>
              {(isAdmin || isSuperAdmin) && (
                <div className="pt-2">
                  <Link
                    to="/admin/dashboard"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.08] text-white hover:bg-[#38bdf8] hover:text-black transition-colors font-mono text-[11px] font-bold"
                  >
                    <span className="material-symbols-outlined text-xs">admin_panel_settings</span>
                    Admin Console
                  </Link>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Lower Copyright & Legal Bar */}
      <div className="border-t border-white/[0.06] bg-black/60 py-6 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-[#71717a] font-mono">
          <div>
            © 2026 Star weAR Inc. All rights reserved. 3D spatial experiences run natively in web browsers without native app installs.
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Link to="/about" className="hover:text-white transition-colors">Manifesto</Link>
            <span>•</span>
            <Link to="/contact" className="hover:text-white transition-colors">Direct Concierge</Link>
            <span>•</span>
            <span className="hover:text-white cursor-pointer transition-colors">Privacy Policy</span>
            <span>•</span>
            <span className="hover:text-white cursor-pointer transition-colors">Terms of Sale</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
