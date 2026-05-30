import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const AdminOrders = () => {
  const [filter, setFilter] = useState('All');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const fetchedOrders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setOrders(fetchedOrders);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(order => filter === 'All' || order.status === filter);

  return (
    <>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6">
        <div>
          <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background">Orders</h2>
          <p className="text-secondary mt-2">Track and manage customer orders.</p>
        </div>
        <div className="flex gap-4">
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-transparent border-b border-outline-variant focus:border-primary py-2 text-sm focus:outline-none transition-colors text-on-background"
          >
            <option value="All">All Statuses</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
          </select>
        </div>
      </header>
      
      <section className="glass-panel rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 text-secondary font-label-caps text-xs">
                <th className="p-6 font-normal">ORDER ID</th>
                <th className="p-6 font-normal">DATE</th>
                <th className="p-6 font-normal">CUSTOMER</th>
                <th className="p-6 font-normal">TOTAL</th>
                <th className="p-6 font-normal">STATUS</th>
                <th className="p-6 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="font-body-sm text-on-background">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-secondary">
                    Loading orders...
                  </td>
                </tr>
              ) : filteredOrders.map((order) => (
                <tr key={order.id} className="border-b border-outline-variant/10 hover:bg-surface-variant/20 transition-colors">
                  <td className="p-6 font-bold">{order.id.substring(0, 8)}...</td>
                  <td className="p-6 text-secondary">
                    {order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="p-6">{order.customerEmail || 'Guest'}</td>
                  <td className="p-6">${(order.total || 0).toFixed(2)}</td>
                  <td className="p-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-label-caps ${
                      order.status === 'paid' ? 'bg-primary/10 text-primary' : 
                      order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 
                      'bg-blue-500/10 text-blue-500'
                    }`}>
                      {order.status || 'pending'}
                    </span>
                  </td>
                  <td className="p-6 text-right space-x-2">
                    <button className="text-secondary hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[20px]">visibility</span>
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-secondary">
                    No orders found matching status "{filter}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
};

export default AdminOrders;
