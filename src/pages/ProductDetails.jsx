import React, { useState } from 'react';
import Header from '../components/Header';
import ProductViewer from '../components/ProductViewer';
import { useCart } from '../context/CartContext';

function ProductDetails() {
  const [selectedSize, setSelectedSize] = useState('M');
  const { addToCart } = useCart();

  const handleAddToCart = () => {
    addToCart({
      id: 'essential-zip-fleece',
      name: 'ESSENTIAL ZIP FLEECE',
      price: 185.00,
      size: selectedSize,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA_lPkQp6i1iZnEAk_2TeaylzhDzLW-XhRcKPttTLT1OTzraJo9veg0F-EMKVYrI78nNMmi-zV_9hoI0wtDrEIVas-Gqn5ntJnuFMhVBEG_5oeniqUXyVhJZPnUTZS-4gbyL8dWi_ylDWVts8nNh0jWtR9pIS1SjldmXqeh-XJXRQvV00UPW9JSJJYIN81IJyKEKakN5Dk1cEalWZK0RpfQ2YNSZ8nK1Zg07WFPhbVJy9Bh37yY0xTwXiruuzCdM-OMwnMBtFveOtk' // Using a placeholder that matches design
    });
  };

  return (
    <div className="min-h-screen bg-background text-on-background selection:bg-primary-container selection:text-on-primary-container font-body-md antialiased">
      <Header />
      
      {/* Main Content Canvas */}
      <main className="pt-20 pb-32 min-h-screen">
        {/* Product Showcase Section (Asymmetric Layout based on reference) */}
        <section className="w-full h-[1024px] min-h-[800px] relative overflow-hidden bg-surface-container-lowest">
          <div className="absolute inset-0 flex flex-col md:flex-row h-full">
            {/* Left Side: Glassmorphic Content Panel & Thumbnails */}
            <div className="w-full md:w-1/2 h-full relative z-10 glass-panel border-r border-outline-variant/20 flex flex-col justify-center px-margin-mobile md:px-margin-desktop">
              <div className="max-w-md mx-auto md:mx-0 pt-20 md:pt-0">
                <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background mb-4 uppercase">
                  ESSENTIAL<br />ZIP FLEECE
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant mb-12">
                  A minimalist approach to casual comfort. Crafted from premium heavyweight organic cotton, featuring an oversized fit, drop shoulders, and a subtle half-zip detail. Designed for effortless layering and transitional weather.
                </p>
                {/* Interactive Elements */}
                <div className="hidden md:block space-y-8">
                  {/* Size Selection Placeholder - Added from previous state but mapped to new aesthetics */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="font-label-caps text-label-caps text-on-surface-variant">SIZE</span>
                      <button className="font-label-caps text-[10px] tracking-widest text-primary underline hover:text-on-background transition-colors cursor-pointer">SIZE GUIDE</button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {['S', 'M', 'L', 'XL'].map(size => (
                        <button 
                          key={size} 
                          onClick={() => setSelectedSize(size)}
                          className={`border py-3 font-label-caps transition-all cursor-pointer ${
                            selectedSize === size 
                              ? 'bg-on-background text-on-primary border-on-background' 
                              : 'border-outline-variant/50 hover:border-on-background text-on-surface-variant'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <span className="font-body-lg text-body-lg text-on-background">$185.00</span>
                    <button onClick={handleAddToCart} className="bg-on-background text-on-primary px-8 py-4 font-label-caps text-label-caps hover:bg-on-background/90 transition-colors flex items-center gap-2 cursor-pointer">
                      ADD TO DIGITAL VAULT
                      <span className="material-symbols-outlined text-[18px]">arrow_right_alt</span>
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Thumbnails Strip overlaying bottom left */}
              <div className="absolute bottom-8 left-margin-mobile md:left-margin-desktop flex gap-4 overflow-x-auto no-scrollbar max-w-[calc(100%-40px)]">
                <div className="flex flex-col gap-4">
                  <h4 className="font-label-caps text-[10px] tracking-[0.2em] text-on-background opacity-60 uppercase">Similar Experiences</h4>
                  <div className="flex gap-4">
                    {/* Thumbnail 1 */}
                    <div className="flex flex-col gap-2">
                      <div className="glass-panel border border-outline-variant/30 w-24 h-24 md:w-28 md:h-28 flex flex-col items-center justify-center p-2 group cursor-pointer hover:border-primary/50 transition-colors">
                        <div className="w-full h-full overflow-hidden mb-1 flex items-center justify-center">
                           <span className="material-symbols-outlined text-outline-variant text-4xl group-hover:scale-110 transition-transform duration-500">view_in_ar</span>
                        </div>
                        <span className="font-label-caps text-[8px] tracking-widest text-on-surface-variant">.USDZ ASSET</span>
                      </div>
                      <div className="flex flex-col px-1">
                        <span className="font-headline-lg text-[12px] tracking-wider text-on-background">$45.00</span>
                        <button className="text-[9px] font-label-caps text-primary text-left hover:underline uppercase cursor-pointer">Add to cart</button>
                      </div>
                    </div>

                    {/* Thumbnail 2 */}
                    <div className="flex flex-col gap-2">
                      <div className="glass-panel border border-outline-variant/30 w-24 h-24 md:w-28 md:h-28 flex flex-col items-center justify-center p-2 group cursor-pointer hover:border-primary/50 transition-colors">
                        <div className="w-full h-full overflow-hidden mb-1 flex items-center justify-center opacity-80">
                           <span className="material-symbols-outlined text-outline-variant text-4xl group-hover:scale-110 transition-transform duration-500">view_in_ar</span>
                        </div>
                        <span className="font-label-caps text-[8px] tracking-widest text-on-surface-variant">.USDZ ASSET</span>
                      </div>
                      <div className="flex flex-col px-1">
                        <span className="font-headline-lg text-[12px] tracking-wider text-on-background">$65.00</span>
                        <button className="text-[9px] font-label-caps text-primary text-left hover:underline uppercase cursor-pointer">Add to cart</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Side: Full Bleed Image Anchor / 3D Viewer */}
            <div className="hidden md:block w-1/2 h-full relative bg-[#151a1e] overflow-hidden group">
              <ProductViewer />
              
              {/* Top Right Badge */}
              <div className="absolute top-6 right-6 flex items-center gap-2 bg-background/80 backdrop-blur-md px-3 py-1.5 border border-outline-variant/30 pointer-events-none">
                <span className="material-symbols-outlined text-[16px] text-primary">3d_rotation</span>
                <span className="font-label-caps text-[10px] tracking-widest text-on-background">3D INTERACTIVE</span>
              </div>
              
              {/* Bottom Instructional Overlay */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <span className="material-symbols-outlined text-[20px] text-white">drag_pan</span>
                <span className="font-label-caps text-label-caps text-[11px] whitespace-nowrap text-white">DRAG TO ROTATE</span>
              </div>
            </div>
          </div>
        </section>
        
        {/* Accordion Details (Bento Grid Style) */}
        <section className="px-margin-mobile md:px-margin-desktop py-24 max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            <div className="p-8 border border-outline-variant/20 hover:border-outline-variant/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-primary font-light">info</span>
                <h3 className="font-label-caps text-label-caps text-on-background">DETAILS</h3>
              </div>
              <ul className="space-y-2 font-body-md text-on-surface-variant text-sm">
                <li>• 100% Organic Heavyweight Cotton</li>
                <li>• 450gsm brushed fleece interior</li>
                <li>• YKK silver-tone half zipper</li>
                <li>• Dropped shoulder silhouette</li>
                <li>• Ribbed cuffs and hem</li>
              </ul>
            </div>
            
            <div className="p-8 border border-outline-variant/20 hover:border-outline-variant/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-primary font-light">straighten</span>
                <h3 className="font-label-caps text-label-caps text-on-background">FIT & SIZING</h3>
              </div>
              <p className="font-body-md text-on-surface-variant text-sm mb-4">
                Designed for an intentionally oversized, relaxed fit. We recommend taking your normal size for the intended look, or sizing down for a more standard fit.
              </p>
              <p className="font-body-md text-on-surface-variant text-sm italic">
                Model is 5'9" and wears size Small.
              </p>
            </div>
            
            <div className="p-8 border border-outline-variant/20 hover:border-outline-variant/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-primary font-light">local_shipping</span>
                <h3 className="font-label-caps text-label-caps text-on-background">SHIPPING</h3>
              </div>
              <p className="font-body-md text-on-surface-variant text-sm mb-4">
                Complimentary express shipping on all orders over $200. Standard delivery typically takes 3-5 business days.
              </p>
              <button className="font-label-caps text-label-caps text-primary underline hover:text-on-background transition-colors cursor-pointer">
                VIEW RETURN POLICY
              </button>
            </div>
          </div>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="bg-background text-on-background font-body-md text-body-md w-full py-16 px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-8 border-t border-outline-variant/30 bottom-0">
        <div className="font-headline-lg text-headline-lg text-on-background">
          LUXE EDITORIAL
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          <a className="text-secondary hover:text-on-background hover:underline transition-all" href="#">PRIVACY POLICY</a>
          <a className="text-secondary hover:text-on-background hover:underline transition-all" href="#">TERMS OF SERVICE</a>
          <a className="text-secondary hover:text-on-background hover:underline transition-all" href="#">SHIPPING & RETURNS</a>
          <a className="text-secondary hover:text-on-background hover:underline transition-all" href="#">INSTAGRAM</a>
          <a className="text-secondary hover:text-on-background hover:underline transition-all" href="#">FACEBOOK</a>
        </div>
        <div className="text-sm text-secondary">
          © 2024 LUXE EDITORIAL. ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );
}

export default ProductDetails;
