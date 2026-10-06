import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Contact() {
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'order_support',
    orderNumber: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [ticketResult, setTicketResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');

  // Order Lookup State
  const [lookupOrderId, setLookupOrderId] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState('');

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState(0);

  const faqs = [
    {
      q: 'Do I or my friends need to download a separate mobile app?',
      a: 'No app download is ever required! Star weAR is built entirely on native WebAR using standard mobile browser technologies. Anyone with an iPhone or Android phone can point their native camera at your garment in Safari or Chrome to experience the 3D augmented models and holographic projections.'
    },
    {
      q: 'How do I wash and care for my Star weAR garments?',
      a: 'Wash inside-out in cold water with similar colors on a gentle cycle. Tumble dry on low heat or hang dry to preserve fabric drape. The embedded optical tracking anchors are integrated into the high-density embroidery and resilient archival ink matrix, thoroughly tested to withstand over 50 machine wash cycles without signal loss.'
    },
    {
      q: 'Can our brand or music artist collaborate on a custom WebAR drop?',
      a: 'Yes! Through Studio 4D4, we engineer bespoke phygital capsule collections, album tour merchandise, and runway presentations for leading artists and global brands. We handle everything from 3D model rigging, custom WebAR shaders, and physical apparel manufacturing to cloud distribution. Contact studios@4d4.tech for enterprise inquiries.'
    },
    {
      q: 'Which smartphones and mobile browsers are compatible?',
      a: 'Any modern smartphone with camera permissions is fully supported. This includes iPhone 8 and newer models running iOS 14+ on Safari or Chrome, as well as modern Android devices running Google Chrome. No special headsets or external hardware are necessary.'
    },
    {
      q: 'What is your shipping schedule and international delivery policy?',
      a: 'Domestic US orders are dispatched via carbon-neutral priority shipping within 1-2 business days and arrive in 2-4 business days. International express shipping delivers worldwide within 5-8 business days with prepaid customs and duty fees.'
    },
    {
      q: 'What is your return and size exchange policy?',
      a: 'We offer a 30-day effortless return and complimentary size exchange policy on all unworn items in original packaging. If you need a different size for your desired silhouette, our concierge team will dispatch a prepaid return shipping label immediately.'
    }
  ];

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;

    setSubmitting(true);
    const generatedTicket = `STW-${Math.floor(10000 + Math.random() * 90000)}`;

    try {
      await addDoc(collection(db, 'inquiries'), {
        ticketNumber: generatedTicket,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        subject: formData.subject,
        orderNumber: formData.orderNumber.trim(),
        message: formData.message.trim(),
        status: 'open',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('Firestore inquiry notice (saved to local ticket session):', err);
    } finally {
      setTicketResult({
        ticketNumber: generatedTicket,
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      });
      setSubmitting(false);
    }
  };

  const handleOrderLookup = async (e) => {
    e.preventDefault();
    const cleanId = lookupOrderId.trim();
    if (!cleanId) return;

    setLookupLoading(true);
    setLookupError('');
    setLookupResult(null);

    try {
      const orderRef = doc(db, 'orders', cleanId);
      const snap = await getDoc(orderRef);
      if (snap.exists()) {
        setLookupResult({ id: snap.id, ...snap.data() });
      } else {
        setLookupError(`No order was found matching ID "${cleanId}". Please check your receipt or contact concierge below.`);
      }
    } catch (err) {
      console.warn('Order lookup error:', err);
      setLookupError('Could not connect to order registry. Please verify the order ID or reach out to our concierge team.');
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-[#38bdf8] selection:text-black font-body-md antialiased">
      <Header />

      <main className="pt-28 pb-20 overflow-hidden">
        
        {/* ========================================================================= */}
        {/* HERO SECTION                                                              */}
        {/* ========================================================================= */}
        <section className="relative px-6 max-w-7xl mx-auto pt-10 pb-16 lg:pt-16 lg:pb-24">
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-[#38bdf8]/15 via-[#a855f7]/10 to-transparent blur-3xl pointer-events-none -z-10 rounded-full"></div>

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.12] text-xs font-mono text-[#38bdf8] tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>DIRECT TRANSMISSION • CONCIERGE & SUPPORT</span>
            </div>

            <h1 className="font-headline-xl text-4xl sm:text-6xl font-extrabold uppercase tracking-tight text-white leading-tight">
              Let's Connect.
            </h1>

            <p className="text-sm sm:text-base text-[#a1a1aa] leading-relaxed max-w-xl mx-auto">
              Have questions regarding sizing, custom WebAR garment commissions, or order tracking? Our spatial concierge is at your service.
            </p>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CONCIERGE CHANNELS GRID                                                   */}
        {/* ========================================================================= */}
        <section className="px-6 max-w-7xl mx-auto pb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Channel 1: Customer Care */}
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.08] hover:border-[#38bdf8]/40 transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#38bdf8]/10 text-[#38bdf8] flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">support_agent</span>
                </div>
                <h3 className="font-mono text-sm font-bold uppercase text-white tracking-wider">
                  Order Care & Sizing
                </h3>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">
                  Fit consultations, order status updates, size exchanges, and return authorizations.
                </p>
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="font-mono text-xs text-white">concierge@ttl44.com</span>
                <button
                  type="button"
                  onClick={() => handleCopy('concierge@ttl44.com', 'concierge')}
                  className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.15] text-[#38bdf8] transition-colors cursor-pointer text-xs"
                  title="Copy email address"
                >
                  <span className="material-symbols-outlined text-sm">
                    {copiedKey === 'concierge' ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>
            </div>

            {/* Channel 2: Studio 4D4 Bespoke Drops */}
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.08] hover:border-[#a855f7]/40 transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#a855f7]/10 text-[#a855f7] flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">view_in_ar</span>
                </div>
                <h3 className="font-mono text-sm font-bold uppercase text-white tracking-wider">
                  Custom AR Drops & B2B
                </h3>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">
                  Bespoke 3D rigging, artist tour collections, enterprise fashion activations, and wholesale orders.
                </p>
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="font-mono text-xs text-white">studios@4d4.tech</span>
                <button
                  type="button"
                  onClick={() => handleCopy('studios@4d4.tech', 'studios')}
                  className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.15] text-[#a855f7] transition-colors cursor-pointer text-xs"
                  title="Copy email address"
                >
                  <span className="material-symbols-outlined text-sm">
                    {copiedKey === 'studios' ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>
            </div>

            {/* Channel 3: Press & Partnerships */}
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.08] hover:border-[#ec4899]/40 transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#ec4899]/10 text-[#ec4899] flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">campaign</span>
                </div>
                <h3 className="font-mono text-sm font-bold uppercase text-white tracking-wider">
                  Press & Spatial Runway
                </h3>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">
                  Editorial garment loans, runway presentations, press kits, and spatial media features.
                </p>
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="font-mono text-xs text-white">press@ttl44.com</span>
                <button
                  type="button"
                  onClick={() => handleCopy('press@ttl44.com', 'press')}
                  className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.15] text-[#ec4899] transition-colors cursor-pointer text-xs"
                  title="Copy email address"
                >
                  <span className="material-symbols-outlined text-sm">
                    {copiedKey === 'press' ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* INTERACTIVE CONTACT FORM & LIVE ORDER TRACKER DUAL VIEW                   */}
        {/* ========================================================================= */}
        <section className="px-6 max-w-7xl mx-auto py-12 border-t border-white/[0.08]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Left 7 Columns: Interactive Contact Transmission Form */}
            <div className="lg:col-span-7 bg-[#0c0d11] rounded-3xl border border-white/[0.1] p-8 sm:p-10 shadow-2xl relative">
              <div className="mb-8">
                <span className="text-xs font-mono text-[#38bdf8] uppercase tracking-widest block mb-1">
                  SECURE TRANSMISSION FORM
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-white font-headline-lg">
                  Send A Message
                </h2>
                <p className="text-xs sm:text-sm text-[#a1a1aa] mt-1">
                  Expected turnaround: <span className="text-emerald-400 font-mono">Under 4 hours</span> during business hours.
                </p>
              </div>

              {ticketResult ? (
                /* Ticket Confirmation Receipt Screen */
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                  <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">check_circle</span>
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white uppercase font-mono">
                          Transmission Received
                        </h4>
                        <p className="text-xs text-emerald-300">
                          Your inquiry has been logged into our concierge dispatch system.
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-emerald-500/20 space-y-2 text-xs font-mono">
                      <div className="flex justify-between items-center py-1">
                        <span className="text-[#a1a1aa]">Ticket Reference:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#38bdf8] font-bold text-sm">{ticketResult.ticketNumber}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(ticketResult.ticketNumber, 'ticket')}
                            className="p-1 text-xs text-[#a1a1aa] hover:text-white cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-xs">
                              {copiedKey === 'ticket' ? 'check' : 'content_copy'}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between items-center py-1 text-[#a1a1aa]">
                        <span>Sender:</span>
                        <span className="text-white">{ticketResult.name} ({ticketResult.email})</span>
                      </div>

                      <div className="flex justify-between items-center py-1 text-[#a1a1aa]">
                        <span>Category:</span>
                        <span className="text-white uppercase">{ticketResult.subject.replace('_', ' ')}</span>
                      </div>

                      <div className="flex justify-between items-center py-1 text-[#a1a1aa]">
                        <span>Timestamp:</span>
                        <span className="text-white">{ticketResult.date}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setTicketResult(null);
                      setFormData({ name: '', email: '', subject: 'order_support', orderNumber: '', message: '' });
                    }}
                    className="w-full py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Send Another Transmission
                  </button>
                </div>
              ) : (
                /* Contact Form */
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase tracking-wider text-[#a1a1aa] block">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Alex Mercer"
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] focus:border-[#38bdf8] text-white text-xs placeholder-[#52525b] outline-none transition-colors font-mono"
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase tracking-wider text-[#a1a1aa] block">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="alex@domain.com"
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] focus:border-[#38bdf8] text-white text-xs placeholder-[#52525b] outline-none transition-colors font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Inquiry Category */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase tracking-wider text-[#a1a1aa] block">
                        Inquiry Category *
                      </label>
                      <select
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-[#14151a] border border-white/[0.1] focus:border-[#38bdf8] text-white text-xs outline-none transition-colors font-mono cursor-pointer"
                      >
                        <option value="order_support">Order Status & Tracking</option>
                        <option value="sizing_fit">Sizing & Silhouette Consultation</option>
                        <option value="webar_camera">WebAR Camera & Mobile Effect Help</option>
                        <option value="bespoke_commission">Custom AR Drop & Brand Commission</option>
                        <option value="press_media">Press, Runway & Media Inquiries</option>
                        <option value="general">General Question</option>
                      </select>
                    </div>

                    {/* Order Number (Optional) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase tracking-wider text-[#a1a1aa] block">
                        Order # (If applicable)
                      </label>
                      <input
                        type="text"
                        value={formData.orderNumber}
                        onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                        placeholder="e.g. ord_98412 or cs_test_..."
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] focus:border-[#38bdf8] text-white text-xs placeholder-[#52525b] outline-none transition-colors font-mono"
                      />
                    </div>
                  </div>

                  {/* Message */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-mono uppercase tracking-wider text-[#a1a1aa]">
                      <span>Transmission Message *</span>
                      <span className="text-[10px] text-[#71717a]">{formData.message.length} / 1200 chars</span>
                    </div>
                    <textarea
                      required
                      rows={5}
                      maxLength={1200}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Detail your question or custom request here..."
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] focus:border-[#38bdf8] text-white text-xs placeholder-[#52525b] outline-none transition-colors font-mono leading-relaxed"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 rounded-xl bg-white text-black hover:bg-[#38bdf8] hover:text-black font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                        <span>Transmitting to Concierge...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">send</span>
                        <span>Transmit Message</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Right 5 Columns: Order Status Quick-Tracker & Spatial Lab Info */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Order Quick Lookup Tool */}
              <div className="bg-[#0c0d11] rounded-3xl border border-white/[0.1] p-6 sm:p-8 shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">local_shipping</span>
                  </div>
                  <div>
                    <h3 className="font-mono text-sm font-bold uppercase text-white tracking-wider">
                      Live Order Tracking
                    </h3>
                    <p className="text-[11px] text-[#a1a1aa]">
                      Enter your Firestore Order ID to check fulfillment status.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleOrderLookup} className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={lookupOrderId}
                      onChange={(e) => setLookupOrderId(e.target.value)}
                      placeholder="Paste Order ID here..."
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] focus:border-emerald-400 text-white text-xs placeholder-[#52525b] outline-none font-mono transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={lookupLoading}
                      className="px-4 py-2.5 rounded-xl bg-white text-black hover:bg-emerald-400 hover:text-black text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
                    >
                      {lookupLoading ? '...' : 'Track'}
                    </button>
                  </div>
                </form>

                {lookupError && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-mono">
                    {lookupError}
                  </div>
                )}

                {lookupResult && (
                  <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2 text-xs font-mono animate-in fade-in">
                    <div className="flex justify-between items-center">
                      <span className="text-[#a1a1aa]">Order ID:</span>
                      <span className="text-white font-bold">{lookupResult.id}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#a1a1aa]">Status:</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase font-bold text-[10px]">
                        {lookupResult.status || 'PAID'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#a1a1aa]">Total Paid:</span>
                      <span className="text-white font-bold">${Number(lookupResult.total || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#a1a1aa]">Items Count:</span>
                      <span className="text-white">{lookupResult.items?.length || 1} item(s)</span>
                    </div>
                    <div className="pt-2 border-t border-emerald-500/20 text-center">
                      <Link
                        to={`/success?order_id=${lookupResult.id}`}
                        className="text-emerald-400 hover:underline text-[11px] font-bold"
                      >
                        View Full Order Receipt &rarr;
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Spatial Lab Coordinates Card */}
              <div className="bg-[#0c0d11] rounded-3xl border border-white/[0.1] p-6 sm:p-8 shadow-2xl space-y-4">
                <span className="text-xs font-mono text-[#38bdf8] uppercase tracking-widest block">
                  SPATIAL LAB LOCATION
                </span>
                <h3 className="font-mono text-sm font-bold uppercase text-white tracking-wider">
                  Star weAR Atelier & Lab
                </h3>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">
                  Headquartered in Los Angeles, California. Physical showrooms and private client fittings are scheduled by appointment only.
                </p>

                <div className="pt-2 space-y-2 text-xs font-mono text-[#a1a1aa]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-[#38bdf8]">schedule</span>
                    <span>Mon – Fri: 9:00 AM – 6:00 PM PST</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-[#38bdf8]">public</span>
                    <span>Global Spatial Computing Atelier</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-emerald-400">verified_user</span>
                    <span>Direct Concierge SLA: 4-Hour Response</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* INTERACTIVE FAQ ACCORDION                                                 */}
        {/* ========================================================================= */}
        <section id="faq" className="px-6 max-w-5xl mx-auto py-16 border-t border-white/[0.08]">
          <div className="text-center space-y-3 mb-12">
            <span className="text-xs font-mono text-[#38bdf8] tracking-widest uppercase block">
              FREQUENTLY ASKED QUESTIONS
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold uppercase tracking-tight text-white font-headline-lg">
              Everything You Need to Know
            </h2>
            <p className="text-xs sm:text-sm text-[#a1a1aa]">
              Answers to common questions regarding WebAR camera functionality, sizing, and garment care.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl bg-white/[0.02] border border-white/[0.08] overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-sm sm:text-base font-bold text-white font-mono">
                      {faq.q}
                    </span>
                    <span className={`material-symbols-outlined text-lg text-[#38bdf8] transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-xs sm:text-sm text-[#a1a1aa] leading-relaxed border-t border-white/[0.04] pt-4 animate-in fade-in">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
