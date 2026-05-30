import React from 'react';
import Header from '../components/Header';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const PRODUCTS = [
  {
    id: 'cashmere-blend-turtleneck',
    name: 'CASHMERE BLEND TURTLENECK',
    price: 245.00,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZdXcsZ7SxPesyEx3Xf7mgvaFR5wCJh5kP1h4vEwXCO44buzSUUu5OXvMQDQ1kd1AByD8eb8bjGgBb6i6dItQLRlp4AC5XO8Etmfaml_oLVLb7_sWIqUw-v7MSge6eE_GOcc2zhM8PmuLsUG5TkJ0_TPhP6MZ2iBScaYs6PFbf6G7s-B2V-2IwOqiOm1_VDSspKSEkuMr_Qg1bzgPRy7uY_5qRTEnv3OXkqnVLQPBJR6KkIFpknilFefam50tsV1tAwmZO6lOSbIs',
    badge: 'NEW IN',
    badgeColor: 'text-primary'
  },
  {
    id: 'structured-wool-coat',
    name: 'STRUCTURED WOOL COAT',
    price: 890.00,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB3HnT6WyAEhlCfXKzbYau8vGBpAI0AVHBb5Yc5qk1s-OoRPsaKT9nWy5MohFLogmX9q99MmiFOg6ajrQ_OT2cph-i8b0mvc_HVA-ioGFU4lHZ4yHYcWc6fkE5AeMqCBBr0vxOGU_NqcTw-m94_oYLYRujrWmIcrBqOybLogkILgX2lOXTnX_j3TSU9OiMuqOBcrdT7HWQsZopitEZf1e6vzTN3bIwbtTU92ihFR3LOwK12yHJpv6GBmBCOs3f_NnqYBGxrPxU4Uos'
  },
  {
    id: 'draped-silk-trousers',
    name: 'DRAPED SILK TROUSERS',
    price: 420.00,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBhgqG9T3ITqkST7CAgDi6x7lYuuNhom_1d-WhbOmQsj7b2wrS6rzqwjgwK2w88Cbnu8OAjWXkOwGOVwAMs_V8d2wXWO1FUzq-tUhwMb44vzqrj9SXqq7n1veLhYIXubz01I2D2ktcB3ny-5L4lKC6ZTz9dGfuZtfuw0wCnfw_VWpzverp8QRXuFJhFqm5U07LhOqSJWqnQZmK5xIm5bSkYrybX-Gm-FLqPu5wYMgTU3825ExsoSc5lJemnKw8hvVHUhVt2l0778cY',
    badge: 'SUSTAINABLE',
    badgeColor: 'text-secondary'
  },
  {
    id: 'architectural-mini-bag',
    name: 'ARCHITECTURAL MINI BAG',
    price: 550.00,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD39a--sPkdCUigzpgt8qfN291N_D9ou-y0CVtLSw8Ynw_PN1WrV2d9jNnwHA7JzqhEc_Dsco-927SUYBsNOiJeJuKo3uMq7GVr1V0Y2wqnLVSZrITYk1KuGcI3Djqf2uQ31InoX8CpHNCxw-qN5iyjQ5XCmzpk8MiQ75fkP-8c6_wCCJGKL6r4-yjsWwamsJre4Dedg-r--VnxPzgxgCECNVMwwh6_9CrcAGmvHgVhheCQ1YB7QrbkgnSBQHM9gT4VJ_BlK50qpCc'
  },
  {
    id: 'organza-layering-top',
    name: 'ORGANZA LAYERING TOP',
    price: 280.00,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDKortf3sfHLsRxiRwoOdyCpy2SZlZXn1KYIsEu4G2jBmmvXHOEWj7wMv3V7k7zvdyo8HeJHUeJ8dfHQ7HiXteVfYVGbTCqkDi0Q8652oSCkSJjFxUc39HQL0AvrdsHVf31POnud6Q3EDlVokOv899h65OeWxRa_4SWPDda8LZDJzamFd5dLq3GQ1wxstUFSeuOvqGlyfaA_YLUfwSuY1C3iwxABrPzIEfNAREw3FuD0dq-mRj6YDFCgJfgE9WGt8csfZJ7S2tq9z0'
  },
  {
    id: 'ribbed-wool-pullover',
    name: 'RIBBED WOOL PULLOVER',
    price: 310.00,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCXmneznMKblQD2UJJSIqag4uTRH-GwK836TnQPwaHu3awz0Ms2bZWr6Uh3sM8BWAk-E3IO6z-JkKzdvOLfcCEVx7x3tnWhaqymsf2h1OJtyOzNRfFOS9oS2czD4M0zGp-S0E54IX2rVQBriSYsKdHrXVgLn7xulPpMsIaeoIuOAW6wYg8Qv5eb_I65jNv8wx7-JSHgC7W0Ffdm0zDEOY2WKlhxUyWr6plxwMxhKt79mxS_TUcqABZwQfDZ6A3IEdRBUE7XRd_1bhQ'
  }
];

export default function Collections() {
  const { addToCart } = useCart();

  const handleAddToCart = (e, product) => {
    e.preventDefault(); // Prevent navigating to /product when clicking the add to cart button
    addToCart(product);
  };

  return (
    <div className="min-h-screen bg-background text-on-background antialiased selection:bg-primary-container selection:text-on-primary-container">
      <Header />
      
      {/* Main Content Area */}
      <main className="pt-32 pb-24 px-margin-mobile md:px-margin-desktop min-h-screen">
        {/* Header Section */}
        <header className="mb-16 md:mb-24 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div className="max-w-2xl">
            <h1 className="font-headline-xl text-headline-xl mb-4 uppercase">THE EDIT</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
              Curated essentials designed with meticulous attention to detail. Explore our latest collection of minimal, high-end pieces.
            </p>
          </div>
          <div className="flex items-center gap-4 self-end">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">SORT BY</span>
            <select className="bg-transparent border-b border-outline-variant/50 text-on-background font-body-md text-body-md py-2 focus:ring-0 focus:border-primary transition-colors outline-none cursor-pointer uppercase">
              <option>NEWEST</option>
              <option>PRICE: LOW TO HIGH</option>
              <option>PRICE: HIGH TO LOW</option>
            </select>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-gutter">
          {/* Sidebar Filters */}
          <aside className="w-full lg:w-64 flex-shrink-0 mb-12 lg:mb-0 hidden md:block">
            <div className="sticky top-32 space-y-12">
              {/* Categories */}
              <div>
                <h3 className="font-label-caps text-label-caps mb-6 text-on-background uppercase">CATEGORY</h3>
                <ul className="space-y-4 font-body-md text-body-md text-on-surface-variant">
                  <li>
                    <a className="hover:text-primary transition-colors flex justify-between group" href="#">
                      <span>Outerwear</span> <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </a>
                  </li>
                  <li>
                    <a className="text-primary flex justify-between" href="#">
                      <span>Knitwear</span> <span>→</span>
                    </a>
                  </li>
                  <li>
                    <a className="hover:text-primary transition-colors flex justify-between group" href="#">
                      <span>Dresses</span> <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </a>
                  </li>
                  <li>
                    <a className="hover:text-primary transition-colors flex justify-between group" href="#">
                      <span>Tops</span> <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </a>
                  </li>
                  <li>
                    <a className="hover:text-primary transition-colors flex justify-between group" href="#">
                      <span>Bottoms</span> <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-gutter gap-y-16">
            {PRODUCTS.map((product) => (
              <article key={product.id} className="group cursor-pointer">
                <Link to="/product">
                  <div className="relative aspect-[3/4] mb-6 overflow-hidden bg-surface-container-low rounded-DEFAULT">
                    <img 
                      alt={product.name} 
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out" 
                      src={product.image} 
                    />
                    {product.badge && (
                      <div className={`absolute top-4 left-4 bg-background/80 backdrop-blur-md px-3 py-1 font-label-caps text-[10px] tracking-widest ${product.badgeColor} rounded-full uppercase`}>
                        {product.badge}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-body-lg text-body-lg text-on-background mb-1">{product.name}</h3>
                      <div className="flex items-center gap-4 mt-2">
                        <button 
                          onClick={(e) => handleAddToCart(e, product)}
                          className="font-label-caps text-[10px] tracking-widest text-primary border-b border-primary hover:opacity-70 transition-opacity uppercase z-10 relative">
                          ADD TO CART
                        </button>
                      </div>
                      <p className="font-body-md text-body-md text-on-surface-variant mt-2">${product.price.toFixed(2)}</p>
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </div>

        {/* Pagination / Load More */}
        <div className="mt-24 flex justify-center">
          <button className="px-8 py-4 font-label-caps text-[12px] tracking-widest border border-outline-variant hover:border-primary hover:text-primary transition-colors text-on-surface-variant cursor-pointer uppercase">
            LOAD MORE
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-16 px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-8 bg-background border-t border-outline-variant/30">
        <div className="font-headline-lg text-headline-lg text-on-background uppercase">LUXE EDITORIAL</div>
        <div className="flex flex-wrap justify-center gap-6 md:gap-8">
          <a className="font-label-caps text-[12px] tracking-widest text-secondary hover:text-on-background hover:underline transition-all uppercase" href="#">PRIVACY POLICY</a>
          <a className="font-label-caps text-[12px] tracking-widest text-secondary hover:text-on-background hover:underline transition-all uppercase" href="#">TERMS OF SERVICE</a>
          <a className="font-label-caps text-[12px] tracking-widest text-secondary hover:text-on-background hover:underline transition-all uppercase" href="#">SHIPPING & RETURNS</a>
          <a className="font-label-caps text-[12px] tracking-widest text-secondary hover:text-on-background hover:underline transition-all uppercase" href="#">INSTAGRAM</a>
          <a className="font-label-caps text-[12px] tracking-widest text-secondary hover:text-on-background hover:underline transition-all uppercase" href="#">FACEBOOK</a>
        </div>
        <div className="font-label-caps text-[12px] tracking-widest text-on-surface-variant uppercase">
          © 2024 LUXE EDITORIAL. ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );
}
