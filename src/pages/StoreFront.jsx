import React from 'react';
import Header from '../components/Header';

export default function StoreFront() {
  return (
    <div className="min-h-screen bg-background text-on-background antialiased selection:bg-primary-container selection:text-on-primary-container">
      <Header />

      <main className="min-h-screen">
        {/* Hero Section */}
        <section className="relative h-screen w-full overflow-hidden flex items-center justify-center">
          {/* Background Image */}
          <div className="absolute inset-0 w-full h-full">
            <img
              alt="A high-end fashion editorial shot featuring a model wearing minimalist, loose-fitting blue outerwear and neutral wide-leg trousers."
              className="w-full h-full object-cover object-center"
              src="https://firebasestorage.googleapis.com/v0/b/star-wear-ecb39.firebasestorage.app/o/bg-2.png?alt=media&token=a804ed50-f54b-4c41-843a-be9258a25741"
            />
            {/* Glassmorphism Split Overlay */}
            <div className="absolute inset-y-0 left-0 w-full md:w-1/2 bg-gradient-to-r from-white/70 to-white/30 backdrop-blur-[20px] border-r border-outline-variant/30 flex items-center p-margin-mobile md:p-margin-desktop">
              <div className="max-w-md w-full pt-20 md:pt-0">
                <h1 className="font-headline-lg text-headline-lg-mobile md:text-[80px] md:leading-[90px] md:tracking-[0.05em] md:font-extrabold font-headline-xl text-on-surface mb-6 uppercase">
                  NEON LATTICE
                </h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant mb-10 max-w-sm">
                  Transcend physical boundaries. Experience our first digital-first collection where high-fashion meets the metaverse. Projecting your digital soul onto timeless silhouettes.
                </p>
                <button className="border border-on-surface text-on-surface font-label-caps text-label-caps px-8 py-4 bg-transparent hover:bg-on-surface hover:text-surface transition-all tracking-widest cursor-pointer uppercase">
                  [ PURCHASE & EQUIP ]
                </button>

                {/* Mini Gallery Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 mt-16 w-full gap-y-8 gap-x-4">

                  {/* Item 1 */}
                  <div className="flex flex-col gap-3 group">
                    <div className="aspect-[3/4] overflow-hidden rounded bg-surface-container relative">
                      <img
                        alt="A close-up fashion shot of a light blue textured sweater"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuCBNsGD2pMhhlvsVruvJ9JRh2FzvyIzGLocIqrcxS3QSFNDwmKb4TWDdsiJdklKXqI90D9zH1__AhDYcbhddKCX1MXZ0cbPACtCUXMff-Bzcflmgka7SR9K3S_5UsOJ2D1X-mLS8o6rJt_TqxAQPEN6oWr_4mgNv91dBH2Von_2JQP8uxeDTbabA0BxM2yIWbQcVjM9jThXptLjQgGfPQn21gvrN9Zy6kLKaV_Qj_1cWrU0_BWLD9Z5bHwtKAdyQSBhMuuRBtwWhmU"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="font-label-caps text-[10px] tracking-widest text-on-surface uppercase">NEON LATTICE</div>
                      <div className="font-body-md text-xs text-on-surface-variant">$45.00</div>
                      <button className="text-[10px] font-label-caps tracking-widest text-primary text-left mt-1 hover:opacity-70 transition-opacity uppercase cursor-pointer">ADD TO CART</button>
                    </div>
                  </div>

                  {/* Item 2 */}
                  <div className="flex flex-col gap-3 group">
                    <div className="aspect-[3/4] overflow-hidden rounded bg-surface-container relative">
                      <img
                        alt="A detail shot of a model sitting gracefully"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuBiA4rDjZm7nqCnZb7yhm1AI-kDPz__av_eC8-S9YfJqMEtfGpHD2cN09kkGFdWUlA-WIucLZHw0TM6OGQBCZrXzuqFZ1aX7KHDymh5d3S4jTegBcZw1xhFokMoZftmAGHjlk9tbPUYOGeMxbKFNmL3KdDKGCXHcvlxCLW7k8sv5Iu3tJjFUU1AyZrlUmY3xAavmMo0Tp0dkP3IzUudF1eamQ7IMNV6OPvcLDpUxhi20jKE1p7La3Md22vGJrNr0vH1B06yt3Q_NbQ"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="font-label-caps text-[10px] tracking-widest text-on-surface uppercase">AURA FLOW</div>
                      <div className="font-body-md text-xs text-on-surface-variant">$65.00</div>
                      <button className="text-[10px] font-label-caps tracking-widest text-primary text-left mt-1 hover:opacity-70 transition-opacity uppercase cursor-pointer">ADD TO CART</button>
                    </div>
                  </div>

                  {/* Item 3 */}
                  <div className="flex flex-col gap-3 group">
                    <div className="aspect-[3/4] overflow-hidden rounded bg-surface-container relative">
                      <img
                        alt="A minimal profile view of a model"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDYwzUNyIgA3zshcal-vOY9xfGpdC1GTW9pUNsKFpiFVZfPRosD_NY8NorcalKihk39je9hM6pzF36yeco0ZTVYNMv9sxjgd6xcOYMXWHwqkZx5jVNMsxinsQ3KQ5Dq1-BYf5FLUGnfkDagJ2P0P0Qfw2zuWbAA6b2AMlFMvozf7-oKWCops_y000hMs9jaaL4QoncGedVlkU9n67MzLcZRpeO97q2ieAODoTMclI9egI3NmGW-sxpDKf9a-t2Mkz0OA7_7r3gcwvY"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="font-label-caps text-[10px] tracking-widest text-on-surface uppercase">CYBER WEAVE</div>
                      <div className="font-body-md text-xs text-on-surface-variant">$55.00</div>
                      <button className="text-[10px] font-label-caps tracking-widest text-primary text-left mt-1 hover:opacity-70 transition-opacity uppercase cursor-pointer">ADD TO CART</button>
                    </div>
                  </div>

                  {/* Item 4 */}
                  <div className="flex flex-col gap-3 group">
                    <div className="aspect-[3/4] overflow-hidden rounded bg-surface-container relative">
                      <img
                        alt="AR Skin Thumbnail"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDYwzUNyIgA3zshcal-vOY9xfGpdC1GTW9pUNsKFpiFVZfPRosD_NY8NorcalKihk39je9hM6pzF36yeco0ZTVYNMv9sxjgd6xcOYMXWHwqkZx5jVNMsxinsQ3KQ5Dq1-BYf5FLUGnfkDagJ2P0P0Qfw2zuWbAA6b2AMlFMvozf7-oKWCops_y000hMs9jaaL4QoncGedVlkU9n67MzLcZRpeO97q2ieAODoTMclI9egI3NmGW-sxpDKf9a-t2Mkz0OA7_7r3gcwvY"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="font-label-caps text-[10px] tracking-widest text-on-surface uppercase">DIGITAL SOUL</div>
                      <div className="font-body-md text-xs text-on-surface-variant">$75.00</div>
                      <button className="text-[10px] font-label-caps tracking-widest text-primary text-left mt-1 hover:opacity-70 transition-opacity uppercase cursor-pointer">ADD TO CART</button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-32 px-margin-mobile md:px-margin-desktop bg-surface">
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-8 uppercase">
              ELEVATED EVERYDAY
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mx-auto">
              Explore our curated selection of timeless pieces. Each garment is crafted with meticulous attention to detail, designed to blend seamlessly into your curated wardrobe.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-background text-on-background font-body-md text-body-md w-full py-16 px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-8 border-t border-outline-variant/30 bottom-0">
        <div className="font-headline-lg text-headline-lg text-on-background uppercase">
          LUXE EDITORIAL
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          <a className="text-secondary hover:text-on-background hover:underline transition-all font-label-caps text-label-caps" href="#">PRIVACY POLICY</a>
          <a className="text-secondary hover:text-on-background hover:underline transition-all font-label-caps text-label-caps" href="#">TERMS OF SERVICE</a>
          <a className="text-secondary hover:text-on-background hover:underline transition-all font-label-caps text-label-caps" href="#">SHIPPING & RETURNS</a>
          <a className="text-secondary hover:text-on-background hover:underline transition-all font-label-caps text-label-caps" href="#">INSTAGRAM</a>
          <a className="text-secondary hover:text-on-background hover:underline transition-all font-label-caps text-label-caps" href="#">FACEBOOK</a>
        </div>
        <div className="text-sm text-secondary font-label-caps text-label-caps">
          © 2024 LUXE EDITORIAL. ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );
}
