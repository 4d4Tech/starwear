import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { parseOrderDate } from '../hooks/useAnalyticsData';
import { formatCurrency } from '../utils/chartConfig';
import { calculateStripeFeeBreakdown } from '../services/stripeService';

const AdminOrders = () => {
  const [filter, setFilter] = useState('All');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const ordersRef = collection(db, 'orders');
        const snapshot = await getDocs(ordersRef);
        const fetchedOrders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Sort in memory safely by date descending
        fetchedOrders.sort((a, b) => parseOrderDate(b).getTime() - parseOrderDate(a).getTime());
        setOrders(fetchedOrders);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(order => {
    if (filter === 'All') return true;
    return (order.status || '').toLowerCase() === filter.toLowerCase();
  });

  return (
    <>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 pb-6 border-b border-outline-variant/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-sm text-primary">shopping_bag</span>
            <span className="font-mono text-xs text-primary tracking-widest uppercase">Order Fulfillment Feed</span>
          </div>
          <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background font-bold tracking-tight">
            Orders
          </h2>
          <p className="text-secondary text-sm mt-1">
            Track customer transactions, Stripe processing fees (2.9% + $0.30), cost breakdowns, and net payouts.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-surface-variant/40 border border-outline-variant/40 focus:border-primary py-2.5 px-4 rounded-lg text-xs font-mono focus:outline-none transition-colors text-on-background cursor-pointer"
          >
            <option value="All">All Statuses ({orders.length})</option>
            <option value="paid">Paid / Completed</option>
            <option value="pending">Pending Sandbox</option>
            <option value="processing">Processing</option>
          </select>
        </div>
      </header>
      
      <section className="glass-panel rounded-xl border border-outline-variant/20 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-outline-variant/20 text-secondary bg-surface-variant/20">
                <th className="p-4 sm:p-5 font-semibold">ORDER ID</th>
                <th className="p-4 sm:p-5 font-semibold">DATE</th>
                <th className="p-4 sm:p-5 font-semibold">CUSTOMER</th>
                <th className="p-4 sm:p-5 font-semibold">GATEWAY</th>
                <th className="p-4 sm:p-5 font-semibold">TOTAL PAID</th>
                <th className="p-4 sm:p-5 font-semibold">STRIPE FEE</th>
                <th className="p-4 sm:p-5 font-semibold">NET PAYOUT</th>
                <th className="p-4 sm:p-5 font-semibold">STATUS</th>
                <th className="p-4 sm:p-5 font-semibold text-right">DETAILS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15 text-on-background">
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-12 text-center text-secondary font-mono">
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading orders from database...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.map((order) => {
                const dateObj = parseOrderDate(order);
                const items = Array.isArray(order.items) ? order.items : [];
                const itemName = items[0]?.name || order.metadata?.productId || 'Digital Garment';
                const summary = items.length > 1 ? `${itemName} (+${items.length - 1})` : itemName;
                const status = (order.status || 'pending').toLowerCase();

                const totalPaid = Number(order.total) || 0;
                const feeDetails = order.feeBreakdown || calculateStripeFeeBreakdown(totalPaid);
                const stripeFee = order.stripeFee !== undefined ? Number(order.stripeFee) : feeDetails.totalFee;
                const netAmount = order.netAmount !== undefined ? Number(order.netAmount) : feeDetails.net;
                const rawGateway = (order.paymentMethod || order.gateway || (order.stripeSessionId ? 'stripe' : 'paypal')).toLowerCase();
                const isStripe = rawGateway === 'stripe' || Boolean(order.stripeSessionId);

                return (
                  <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 sm:p-5 font-bold text-on-background">
                      #{order.id.length > 10 ? order.id.substring(0, 8).toUpperCase() : order.id.toUpperCase()}
                    </td>
                    <td className="p-4 sm:p-5 text-secondary">
                      {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="p-4 sm:p-5 text-secondary truncate max-w-[140px]" title={order.customerEmail || 'Registered User'}>
                      {order.customerEmail || 'Registered User'}
                    </td>
                    <td className="p-4 sm:p-5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isStripe 
                          ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' 
                          : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      }`}>
                        <span className="material-symbols-outlined text-[11px]">{isStripe ? 'credit_card' : 'account_balance_wallet'}</span>
                        <span>{isStripe ? 'Stripe' : 'PayPal'}</span>
                      </span>
                    </td>
                    <td className="p-4 sm:p-5">
                      <span className="font-extrabold text-cyan-400 block text-xs">
                        {formatCurrency(totalPaid, 2)}
                      </span>
                      <span className="text-[10px] text-secondary">Customer Paid</span>
                    </td>
                    <td className="p-4 sm:p-5">
                      <span className="font-semibold text-rose-400 block text-xs">
                        -{formatCurrency(stripeFee, 2)}
                      </span>
                      <span className="text-[10px] text-secondary font-mono">2.9% + $0.30</span>
                    </td>
                    <td className="p-4 sm:p-5">
                      <span className="font-bold text-emerald-400 block text-xs">
                        +{formatCurrency(netAmount, 2)}
                      </span>
                      <span className="text-[10px] text-emerald-400/70 font-mono">
                        {(100 - Number(feeDetails.effectiveRate)).toFixed(1)}% Net
                      </span>
                    </td>
                    <td className="p-4 sm:p-5">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
                        status === 'paid' || status === 'completed'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : status === 'pending'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      }`}>
                        {order.status || 'pending'}
                      </span>
                    </td>
                    <td className="p-4 sm:p-5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="p-1.5 rounded-lg border border-outline-variant/30 hover:border-primary/50 text-secondary hover:text-white transition-colors cursor-pointer"
                        title="Inspect Order & Fee Breakdown"
                      >
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="9" className="p-12 text-center text-secondary font-mono">
                    No orders found matching status "{filter}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Order Details & Cost Breakdown Modal */}
      {selectedOrder && (() => {
        const totalPaid = Number(selectedOrder.total) || 0;
        const feeDetails = selectedOrder.feeBreakdown || calculateStripeFeeBreakdown(totalPaid);
        const stripeFee = selectedOrder.stripeFee !== undefined ? Number(selectedOrder.stripeFee) : feeDetails.totalFee;
        const netPayout = selectedOrder.netAmount !== undefined ? Number(selectedOrder.netAmount) : feeDetails.net;
        const effectiveRate = feeDetails.effectiveRate || (totalPaid > 0 ? ((stripeFee / totalPaid) * 100).toFixed(2) : '0.00');

        const rawGateway = (selectedOrder.paymentMethod || selectedOrder.gateway || (selectedOrder.stripeSessionId ? 'stripe' : 'paypal')).toLowerCase();
        const isStripe = rawGateway === 'stripe' || Boolean(selectedOrder.stripeSessionId);
        const isSandbox = Boolean(selectedOrder.testMode || selectedOrder.metadata?.testMode || selectedOrder.stripeSessionId?.startsWith('cs_test_') || selectedOrder.paypalOrderId?.startsWith('cs_test_'));

        const items = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
        const itemsCount = items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
        const itemsSubtotal = items.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0) || totalPaid;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl p-6 sm:p-8 border border-outline-variant/30 shadow-2xl space-y-6">
              
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-outline-variant/20 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-primary uppercase tracking-widest">Order Details & Cost Telemetry</span>
                    {isSandbox && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        SANDBOX TEST
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-xl font-bold text-on-background font-mono">
                      #{selectedOrder.id}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedOrder.id, 'orderId')}
                      className="p-1 rounded text-secondary hover:text-white transition-colors cursor-pointer"
                      title="Copy Order ID"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {copiedKey === 'orderId' ? 'check' : 'content_copy'}
                      </span>
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-secondary hover:text-white transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Order Meta Attributes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-surface-variant/20 border border-outline-variant/20 text-xs font-mono">
                <div>
                  <span className="text-secondary block text-[11px]">Date Placed:</span>
                  <span className="font-bold text-on-background mt-0.5 block truncate">
                    {parseOrderDate(selectedOrder).toLocaleDateString()}
                  </span>
                  <span className="text-[10px] text-secondary">
                    {parseOrderDate(selectedOrder).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>
                  <span className="text-secondary block text-[11px]">Customer:</span>
                  <span className="font-bold text-on-background mt-0.5 block truncate" title={selectedOrder.customerEmail || 'Registered Customer'}>
                    {selectedOrder.customerEmail || 'Registered Customer'}
                  </span>
                  <span className="text-[10px] text-secondary truncate block">UID: {selectedOrder.userId || 'guest'}</span>
                </div>
                <div>
                  <span className="text-secondary block text-[11px]">Payment Gateway:</span>
                  <span className={`font-bold mt-0.5 block uppercase flex items-center gap-1 ${isStripe ? 'text-indigo-400' : 'text-blue-400'}`}>
                    <span className="material-symbols-outlined text-xs">{isStripe ? 'credit_card' : 'account_balance_wallet'}</span>
                    <span>{isStripe ? 'STRIPE' : 'PAYPAL'}</span>
                  </span>
                  <span className="text-[10px] text-secondary uppercase">{isSandbox ? 'Sandbox' : 'Live Gateway'}</span>
                </div>
                <div>
                  <span className="text-secondary block text-[11px]">Fulfillment Status:</span>
                  <span className={`font-bold mt-0.5 block uppercase ${
                    (selectedOrder.status || '').toLowerCase() === 'paid' ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {selectedOrder.status || 'pending'}
                  </span>
                  <span className="text-[10px] text-secondary">Digital Delivery</span>
                </div>
              </div>

              {/* Comprehensive Financial Breakdown & Stripe Fees */}
              <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/25 via-surface-variant/20 to-black/40 p-5 sm:p-6 space-y-4 shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-outline-variant/20 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#635bff]/20 text-[#635bff] flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-lg">receipt_long</span>
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-on-background uppercase tracking-wider font-mono">
                        Cost Breakdown & Stripe Fees
                      </h4>
                      <p className="text-[11px] text-secondary">
                        Detailed cost breakdown for total amount paid by the customer
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#635bff]/15 text-indigo-300 border border-[#635bff]/30 text-[10px] font-mono font-bold">
                    <span className="material-symbols-outlined text-xs">credit_card</span>
                    <span>Stripe Rate: 2.9% + $0.30</span>
                  </div>
                </div>

                {/* Breakdown Rows */}
                <div className="space-y-2.5 text-xs font-mono">
                  {/* Items Subtotal */}
                  <div className="flex justify-between items-center text-secondary">
                    <span>Garments & Assets Subtotal ({itemsCount} {itemsCount === 1 ? 'item' : 'items'}):</span>
                    <span className="text-on-background font-semibold">{formatCurrency(itemsSubtotal, 2)}</span>
                  </div>

                  {/* Delivery */}
                  <div className="flex justify-between items-center text-secondary">
                    <span>WebAR Interactive Experience Delivery:</span>
                    <span className="text-emerald-400 font-medium">FREE ($0.00)</span>
                  </div>

                  {/* Taxes */}
                  <div className="flex justify-between items-center text-secondary">
                    <span>Estimated Sales Tax:</span>
                    <span className="text-on-background font-medium">$0.00 (Included)</span>
                  </div>

                  {/* Total Customer Paid Banner (Gross) */}
                  <div className="pt-3 border-t border-outline-variant/20 flex justify-between items-baseline">
                    <div>
                      <span className="font-extrabold text-sm text-on-background uppercase tracking-wide block">
                        Total Customer Paid (Gross Amount)
                      </span>
                      <span className="text-[10px] text-secondary">Full charge processed to customer</span>
                    </div>
                    <span className="font-black text-cyan-400 text-lg sm:text-xl">
                      {formatCurrency(totalPaid, 2)} USD
                    </span>
                  </div>

                  {/* Stripe Processing Fee Deduction Card */}
                  <div className="p-4 rounded-xl bg-black/50 border border-rose-500/30 space-y-2.5 mt-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
                        <span className="font-bold text-rose-300 uppercase tracking-wide text-xs">
                          Stripe Processing Fee (Expense)
                        </span>
                      </div>
                      <span className="font-black text-rose-400 text-sm sm:text-base">
                        -{formatCurrency(stripeFee, 2)} USD
                      </span>
                    </div>

                    {/* Itemized Stripe Fee Formula */}
                    <div className="pl-3 border-l-2 border-rose-500/40 space-y-1 text-[11px]">
                      <div className="flex justify-between text-secondary">
                        <span>• Variable Fee (2.9% of {formatCurrency(totalPaid, 2)}):</span>
                        <span className="text-rose-300 font-medium">-{formatCurrency(feeDetails.percentageFee, 2)} USD</span>
                      </div>
                      <div className="flex justify-between text-secondary">
                        <span>• Fixed Transaction Fee (Stripe Card Standard):</span>
                        <span className="text-rose-300 font-medium">-$0.30 USD</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-secondary/70 pt-1 border-t border-outline-variant/15">
                        <span>Effective Processing Fee Rate:</span>
                        <span className="text-rose-300/90 font-mono font-semibold">{effectiveRate}% of transaction</span>
                      </div>
                    </div>
                  </div>

                  {/* Net Merchant Settlement Payout Banner */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 to-emerald-900/20 border border-emerald-500/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-400 text-lg">account_balance</span>
                        <span className="font-black text-emerald-300 uppercase tracking-wider text-xs sm:text-sm">
                          Net Merchant Payout (Settlement)
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-200/80 mt-0.5">
                        Net funds deposited to Star weAR account after Stripe fee deduction
                      </p>
                    </div>
                    <div className="text-left sm:text-right w-full sm:w-auto">
                      <span className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight block">
                        +{formatCurrency(netPayout, 2)} USD
                      </span>
                      <span className="text-[10px] font-mono text-emerald-300/80 uppercase font-semibold">
                        {(100 - Number(effectiveRate)).toFixed(1)}% Retained Net Margin
                      </span>
                    </div>
                  </div>

                  {/* Alternative Gateway Comparison for PayPal orders */}
                  {!isStripe && (
                    <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/25 text-[11px] text-blue-200 space-y-1">
                      <div className="flex items-center justify-between font-bold text-blue-300">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">compare_arrows</span>
                          <span>Gateway Fee Comparison (PayPal vs Stripe)</span>
                        </span>
                        <span>Stripe Fee: {formatCurrency(stripeFee, 2)}</span>
                      </div>
                      <p className="text-[10px] text-blue-200/70">
                        This order was paid with PayPal. If processed via Stripe (2.9% + $0.30), merchant processing fees for this ${totalPaid.toFixed(2)} purchase are exactly <strong>{formatCurrency(stripeFee, 2)}</strong>, with a net payout of <strong>{formatCurrency(netPayout, 2)}</strong>.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Itemized Garments & Line Items */}
              <div>
                <h4 className="text-secondary uppercase tracking-widest text-[11px] font-mono mb-2.5 flex items-center justify-between">
                  <span>Purchased Garments ({items.length})</span>
                  <span>Items Total: {formatCurrency(itemsSubtotal, 2)}</span>
                </h4>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1 text-xs font-mono">
                  {items.map((item, idx) => {
                    const itemPrice = Number(item.price) || 0;
                    const itemQty = item.quantity || 1;
                    const itemLineTotal = itemPrice * itemQty;

                    return (
                      <div key={idx} className="p-3 rounded-xl bg-surface-variant/20 border border-outline-variant/20 flex justify-between items-center gap-3">
                        <div className="flex items-center gap-3">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded-lg border border-outline-variant/20 flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0 border border-outline-variant/20">
                              <span className="material-symbols-outlined text-secondary text-sm">apparel</span>
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-on-background">{item.name || item.id || 'Digital Asset'}</p>
                            <p className="text-[11px] text-secondary">
                              Qty: {itemQty} • Size: {item.size || 'M'} • Unit: {formatCurrency(itemPrice, 2)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-bold text-on-background block">
                            {formatCurrency(itemLineTotal, 2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <p className="text-secondary italic text-xs p-3 rounded-lg bg-surface-variant/10 border border-outline-variant/15">
                      No itemized lines recorded for this order document.
                    </p>
                  )}
                </div>
              </div>

              {/* Transaction Telemetry & Session Reference */}
              <div className="space-y-2 text-xs font-mono">
                <h4 className="text-secondary uppercase tracking-widest text-[11px]">Processor Session Telemetry</h4>
                <div className="p-3.5 rounded-xl bg-black/40 border border-outline-variant/20 space-y-2">
                  {selectedOrder.stripeSessionId && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-secondary flex-shrink-0">Stripe Session ID:</span>
                      <div className="flex items-center gap-1.5 truncate">
                        <code className="text-indigo-400 font-mono text-[11px] truncate max-w-[260px] sm:max-w-[360px]">
                          {selectedOrder.stripeSessionId}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedOrder.stripeSessionId, 'stripeSession')}
                          className="p-1 text-secondary hover:text-white transition-colors cursor-pointer"
                          title="Copy Stripe Session ID"
                        >
                          <span className="material-symbols-outlined text-xs">
                            {copiedKey === 'stripeSession' ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedOrder.paypalOrderId && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-secondary flex-shrink-0">PayPal Order ID:</span>
                      <div className="flex items-center gap-1.5 truncate">
                        <code className="text-blue-400 font-mono text-[11px] truncate max-w-[260px] sm:max-w-[360px]">
                          {selectedOrder.paypalOrderId}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedOrder.paypalOrderId, 'paypalOrder')}
                          className="p-1 text-secondary hover:text-white transition-colors cursor-pointer"
                          title="Copy PayPal Order ID"
                        >
                          <span className="material-symbols-outlined text-xs">
                            {copiedKey === 'paypalOrder' ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-secondary">
                    <span>Firestore Document ID:</span>
                    <span className="text-on-background font-mono">{selectedOrder.id}</span>
                  </div>
                </div>
              </div>

              {/* Source & Metadata (if available) */}
              {selectedOrder.metadata && Object.keys(selectedOrder.metadata).length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-secondary uppercase tracking-widest text-[11px] font-mono">Payload Metadata</h4>
                  <pre className="p-3 rounded-lg bg-black/40 border border-outline-variant/20 text-[11px] font-mono overflow-x-auto text-secondary max-h-32">
                    {JSON.stringify(selectedOrder.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="flex justify-between items-center pt-4 border-t border-outline-variant/20">
                <div className="text-[11px] font-mono text-secondary">
                  <span>Processed by {isStripe ? 'Stripe Checkout API' : 'PayPal Smart Buttons'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-xs font-mono font-bold cursor-pointer transition-colors shadow-md"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};

export default AdminOrders;
