import React from 'react';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import { Link } from 'react-router-dom';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);
};

const AdminDashboard = () => {
  const { data, loading } = useAnalyticsData();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6">
        <div>
          <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background">Dashboard</h2>
          <p className="text-secondary mt-2">Welcome back. Here's what's happening today.</p>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter mb-12">
        <div className="glass-panel p-6 rounded-lg flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <span className="font-label-caps text-xs text-outline tracking-[0.1em]">TOTAL REVENUE</span>
            <span className={`text-xs font-bold ${data.revenueTrend >= 0 ? 'text-success' : 'text-error'}`}>
              {data.revenueTrend >= 0 ? '+' : ''}{data.revenueTrend}%
            </span>
          </div>
          <div className="font-headline-lg text-4xl text-on-background">{formatCurrency(data.totalRevenue)}</div>
        </div>

        <div className="glass-panel p-6 rounded-lg flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <span className="font-label-caps text-xs text-outline tracking-[0.1em]">TOTAL ORDERS</span>
            <span className={`text-xs font-bold ${data.ordersTrend >= 0 ? 'text-success' : 'text-error'}`}>
              {data.ordersTrend >= 0 ? '+' : ''}{data.ordersTrend}%
            </span>
          </div>
          <div className="font-headline-lg text-4xl text-on-background">{data.totalOrders.toLocaleString()}</div>
        </div>

        <div className="glass-panel p-6 rounded-lg flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <span className="font-label-caps text-xs text-outline tracking-[0.1em]">CONVERSION RATE</span>
            <span className={`text-xs font-bold ${data.conversionTrend >= 0 ? 'text-success' : 'text-error'}`}>
              {data.conversionTrend >= 0 ? '+' : ''}{data.conversionTrend}%
            </span>
          </div>
          <div className="font-headline-lg text-4xl text-on-background">{data.conversionRate}%</div>
        </div>

        <div className="glass-panel p-6 rounded-lg flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <span className="font-label-caps text-xs text-outline tracking-[0.1em]">AVG ORDER VALUE</span>
            <span className={`text-xs font-bold ${data.aovTrend >= 0 ? 'text-success' : 'text-error'}`}>
              {data.aovTrend >= 0 ? '+' : ''}{data.aovTrend}%
            </span>
          </div>
          <div className="font-headline-lg text-4xl text-on-background">{formatCurrency(data.averageOrderValue)}</div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        {/* Recent Activity */}
        <section className="glass-panel p-8 rounded-lg flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold text-lg text-on-background">Recent Orders</h3>
            <Link to="/admin/orders" className="text-sm font-label-caps text-primary hover:underline">VIEW ALL</Link>
          </div>
          <div className="flex-1 flex items-center justify-center text-secondary font-body-md italic border-t border-outline-variant/20">
            Fetching recent order activity...
          </div>
        </section>

        {/* Inventory Alerts */}
        <section className="glass-panel p-8 rounded-lg flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold text-lg text-on-background">Inventory Alerts</h3>
            <Link to="/admin/inventory" className="text-sm font-label-caps text-primary hover:underline">MANAGE STOCK</Link>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded bg-surface-variant/30 border border-outline-variant/30">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-error/20 rounded-full flex items-center justify-center text-error">
                  <span className="material-symbols-outlined text-sm">warning</span>
                </div>
                <div>
                  <p className="font-bold text-on-background text-sm">Astro Puffer Jacket</p>
                  <p className="text-xs text-error font-label-caps mt-1">OUT OF STOCK</p>
                </div>
              </div>
              <span className="text-xs text-outline">Just now</span>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded bg-surface-variant/30 border border-outline-variant/30">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-warning/20 rounded-full flex items-center justify-center text-warning">
                  <span className="material-symbols-outlined text-sm">inventory_2</span>
                </div>
                <div>
                  <p className="font-bold text-on-background text-sm">Nebula Cargo Pants</p>
                  <p className="text-xs text-warning font-label-caps mt-1">LOW STOCK (4 LEFT)</p>
                </div>
              </div>
              <span className="text-xs text-outline">2 hours ago</span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default AdminDashboard;
