import React from 'react';

const BuyNowButton = ({ color = '#e11d48', onClick, price, label, disabled = false }) => {
  const displayLabel = label || (price !== undefined && price !== null ? `Buy Now • $${Number(price).toFixed(2)}` : 'Buy Now');

  return (
    <div className="absolute bottom-12 left-1/2 z-50 pointer-events-auto" style={{ transform: 'translateX(-50%)' }}>
      <style>{`
        @keyframes scale-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .ar-buy-btn {
          animation: scale-pulse 2s ease-in-out infinite;
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
        }
        .ar-buy-btn:hover {
          animation: none;
          transform: scale(1.05);
        }
        .ar-buy-btn:active {
          animation: none;
          transform: scale(0.95);
        }
      `}</style>
      <button
        disabled={disabled}
        className="ar-buy-btn px-8 py-3.5 text-white font-bold tracking-wider text-base uppercase cursor-pointer border border-white/20 flex items-center gap-2 backdrop-blur-md disabled:opacity-50"
        style={{
          backgroundColor: color,
          borderRadius: '9999px'
        }}
        onClick={onClick}
      >
        <span className="material-symbols-outlined text-lg">shopping_cart_checkout</span>
        <span>{displayLabel}</span>
      </button>
    </div>
  );
};

export default BuyNowButton;
