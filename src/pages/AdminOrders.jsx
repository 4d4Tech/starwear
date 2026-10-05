import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { parseOrderDate } from '../hooks/useAnalyticsData';
import { formatCurrency } from '../utils/chartConfig';

const AdminOrders = () => {
  const [filter, setFilter] = useState('All');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

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
          <p className="text-secondary text-sm mt-1">Track and manage customer transactions, sandbox purchases, and digital delivery.</p>
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
                <th className="p-4 sm:p-5 font-semibold">ITEMS</th>
                <th className="p-4 sm:p-5 font-semibold">TOTAL</th>
                <th className="p-4 sm:p-5 font-semibold">STATUS</th>
                <th className="p-4 sm:p-5 font-semibold text-right">DETAILS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15 text-on-background">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-secondary font-mono">
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

                return (
                  <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 sm:p-5 font-bold text-on-background">
                      #{order.id.length > 10 ? order.id.substring(0, 8).toUpperCase() : order.id.toUpperCase()}
                    </td>
                    <td className="p-4 sm:p-5 text-secondary">
                      {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="p-4 sm:p-5 text-secondary truncate max-w-[160px]">
                      {order.customerEmail || 'Registered User'}
                    </td>
                    <td className="p-4 sm:p-5 text-secondary truncate max-w-[180px]">
                      {summary}
                    </td>
                    <td className="p-4 sm:p-5 font-bold text-cyan-400">
                      {formatCurrency(Number(order.total) || 0, 2)}
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
                        title="Inspect Order Details"
                      >
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-secondary font-mono">
                    No orders found matching status "{filter}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 sm:p-8 border border-outline-variant/30 shadow-2xl space-y-6">
            <div className="flex justify-between items-start border-b border-outline-variant/20 pb-4">
              <div>
                <span className="text-[10px] font-mono text-primary uppercase tracking-widest">Order Detail Telemetry</span>
                <h3 className="text-xl font-bold text-on-background font-mono mt-0.5">
                  #{selectedOrder.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-secondary hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-surface-variant/30 border border-outline-variant/20">
                <div>
                  <span className="text-secondary block">Date Placed:</span>
                  <span className="font-bold text-on-background mt-0.5 block">
                    {parseOrderDate(selectedOrder).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-secondary block">Total Paid:</span>
                  <span className="font-bold text-cyan-400 mt-0.5 block">
                    {formatCurrency(Number(selectedOrder.total) || 0, 2)}
                  </span>
                </div>
                <div>
                  <span className="text-secondary block">Payment Gateway:</span>
                  <span className="font-bold text-on-background mt-0.5 block uppercase">
                    {selectedOrder.paymentMethod || 'PayPal Sandbox'}
                  </span>
                </div>
                <div>
                  <span className="text-secondary block">Order Status:</span>
                  <span className="font-bold text-emerald-400 mt-0.5 block uppercase">
                    {selectedOrder.status || 'pending'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-secondary uppercase tracking-widest text-[11px] mb-2">Itemized Garments</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(Array.isArray(selectedOrder.items) ? selectedOrder.items : []).map((item, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-surface-variant/20 border border-outline-variant/20 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-on-background">{item.name || item.id}</p>
                        <p className="text-[11px] text-secondary">Qty: {item.quantity || 1} • {item.size || 'Standard'}</p>
                      </div>
                      <span className="font-bold text-on-background">
                        {formatCurrency(Number(item.price) || 0, 2)}
                      </span>
                    </div>
                  ))}
                  {(!selectedOrder.items || selectedOrder.items.length === 0) && (
                    <p className="text-secondary italic">No itemized lines recorded for this order.</p>
                  )}
                </div>
              </div>

              {selectedOrder.metadata && (
                <div>
                  <h4 className="text-secondary uppercase tracking-widest text-[11px] mb-1">Source & Metadata</h4>
                  <pre className="p-3 rounded-lg bg-black/40 border border-outline-variant/20 text-[11px] overflow-x-auto text-secondary">
                    {JSON.stringify(selectedOrder.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 rounded-lg bg-surface-variant hover:bg-surface-variant/80 text-on-background text-xs font-mono font-bold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminOrders;
