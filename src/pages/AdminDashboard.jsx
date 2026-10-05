import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Line, Doughnut } from 'react-chartjs-2';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import {
  formatCurrency,
  getLineChartOptions,
  getDoughnutChartOptions,
  createGradient
} from '../utils/chartConfig';

const AdminDashboard = () => {
  const [activeMetric, setActiveMetric] = useState('revenue'); // 'revenue' | 'orders'
  const { data, loading, error, timeRange, setTimeRange, refresh } = useAnalyticsData('30d');

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="font-mono text-xs text-secondary tracking-widest uppercase">Loading Analytics & Metrics...</p>
      </div>
    );
  }

  // Chart.js Datasets
  const lineChartData = {
    labels: data.chartDatasets?.labels || [],
    datasets: [
      activeMetric === 'revenue'
        ? {
            label: 'Sales Revenue ($)',
            data: data.chartDatasets?.revenue || [],
            borderColor: '#38bdf8',
            backgroundColor: (context) => {
              const ctx = context.chart.ctx;
              return createGradient(ctx, 'rgba(56, 189, 248, 0.32)', 'rgba(56, 189, 248, 0.0)');
            },
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
            pointBackgroundColor: '#38bdf8',
            pointBorderColor: '#0b0f19',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        : {
            label: 'Order Volume',
            data: data.chartDatasets?.orders || [],
            borderColor: '#a855f7',
            backgroundColor: (context) => {
              const ctx = context.chart.ctx;
              return createGradient(ctx, 'rgba(168, 85, 247, 0.32)', 'rgba(168, 85, 247, 0.0)');
            },
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
            pointBackgroundColor: '#a855f7',
            pointBorderColor: '#0b0f19',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }
    ]
  };

  const channelChartData = {
    labels: Object.keys(data.channels || {}),
    datasets: [
      {
        data: Object.values(data.channels || {}),
        backgroundColor: [
          '#38bdf8', // WebAR Try-on
          '#a855f7', // Curated Shop
          '#f59e0b', // Product Page
          '#10b981'  // Cart Checkout
        ],
        borderColor: '#0b0f19',
        borderWidth: 2,
        hoverOffset: 6
      }
    ]
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-outline-variant/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-mono text-xs text-primary tracking-widest uppercase">System Telemetry Live</span>
          </div>
          <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background font-bold tracking-tight">
            Admin Dashboard
          </h2>
          <p className="text-secondary text-sm mt-1">Real-time revenue, order telemetry, and WebAR performance overview.</p>
        </div>

        {/* Controls: Time Range & Refresh */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="bg-surface-variant/40 border border-outline-variant/30 rounded-lg p-1 flex items-center text-xs font-mono">
            {['7d', '30d', '90d', 'all'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                  timeRange === r
                    ? 'bg-primary text-on-primary font-bold shadow-sm'
                    : 'text-secondary hover:text-white'
                }`}
              >
                {r === '7d' ? '7D' : r === '30d' ? '30D' : r === '90d' ? '90D' : 'ALL'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={refresh}
            className="p-2.5 rounded-lg border border-outline-variant/30 hover:border-primary/50 text-secondary hover:text-white transition-colors cursor-pointer"
            title="Refresh Data from Firestore"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="p-4 rounded-xl bg-error/10 border border-error/30 text-error flex items-center gap-3 text-xs font-mono">
          <span className="material-symbols-outlined">warning</span>
          <span>Failed to load some data: {error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between h-40 border border-outline-variant/20 hover:border-primary/40 transition-all shadow-sm">
          <div className="flex justify-between items-start">
            <span className="font-label-caps text-xs text-secondary tracking-widest uppercase">TOTAL REVENUE</span>
            <span
              className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                data.revenueTrend >= 0 ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30' : 'text-rose-400 bg-rose-950/40 border border-rose-500/30'
              }`}
            >
              {data.revenueTrend >= 0 ? '+' : ''}
              {data.revenueTrend}%
            </span>
          </div>
          <div>
            <div className="font-headline-lg text-3xl sm:text-4xl text-on-background font-bold tracking-tight">
              {formatCurrency(data.totalRevenue, 2)}
            </div>
            <p className="text-[11px] text-secondary font-mono mt-1">
              {data.paidOrdersCount} verified transactions
            </p>
          </div>
        </div>

        {/* Total Orders */}
        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between h-40 border border-outline-variant/20 hover:border-primary/40 transition-all shadow-sm">
          <div className="flex justify-between items-start">
            <span className="font-label-caps text-xs text-secondary tracking-widest uppercase">TOTAL ORDERS</span>
            <span
              className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                data.ordersTrend >= 0 ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30' : 'text-rose-400 bg-rose-950/40 border border-rose-500/30'
              }`}
            >
              {data.ordersTrend >= 0 ? '+' : ''}
              {data.ordersTrend}%
            </span>
          </div>
          <div>
            <div className="font-headline-lg text-3xl sm:text-4xl text-on-background font-bold tracking-tight">
              {data.totalOrders.toLocaleString()}
            </div>
            <p className="text-[11px] text-secondary font-mono mt-1">
              {data.pendingOrdersCount} pending approval
            </p>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between h-40 border border-outline-variant/20 hover:border-primary/40 transition-all shadow-sm">
          <div className="flex justify-between items-start">
            <span className="font-label-caps text-xs text-secondary tracking-widest uppercase">CONVERSION RATE</span>
            <span
              className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                data.conversionTrend >= 0 ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30' : 'text-rose-400 bg-rose-950/40 border border-rose-500/30'
              }`}
            >
              {data.conversionTrend >= 0 ? '+' : ''}
              {data.conversionTrend}%
            </span>
          </div>
          <div>
            <div className="font-headline-lg text-3xl sm:text-4xl text-on-background font-bold tracking-tight">
              {data.conversionRate}%
            </div>
            <p className="text-[11px] text-secondary font-mono mt-1">
              Sessions to completed orders
            </p>
          </div>
        </div>

        {/* Average Order Value */}
        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between h-40 border border-outline-variant/20 hover:border-primary/40 transition-all shadow-sm">
          <div className="flex justify-between items-start">
            <span className="font-label-caps text-xs text-secondary tracking-widest uppercase">AVG ORDER VALUE</span>
            <span
              className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                data.aovTrend >= 0 ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30' : 'text-rose-400 bg-rose-950/40 border border-rose-500/30'
              }`}
            >
              {data.aovTrend >= 0 ? '+' : ''}
              {data.aovTrend}%
            </span>
          </div>
          <div>
            <div className="font-headline-lg text-3xl sm:text-4xl text-on-background font-bold tracking-tight">
              {formatCurrency(data.averageOrderValue, 2)}
            </div>
            <p className="text-[11px] text-secondary font-mono mt-1">
              Average cart checkout value
            </p>
          </div>
        </div>
      </section>

      {/* Chart.js Visualizations Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Interactive Chart: Sales Trends */}
        <div className="glass-panel p-6 sm:p-8 rounded-xl lg:col-span-2 border border-outline-variant/20 flex flex-col shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h3 className="font-bold text-lg text-on-background tracking-wide">Performance Overview</h3>
              <p className="text-xs text-secondary font-mono mt-0.5">Chart.js dynamic telemetry visualization</p>
            </div>
            <div className="flex items-center gap-2 bg-surface-variant/40 p-1 rounded-lg border border-outline-variant/30 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveMetric('revenue')}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                  activeMetric === 'revenue'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                    : 'text-secondary hover:text-white'
                }`}
              >
                Revenue ($)
              </button>
              <button
                type="button"
                onClick={() => setActiveMetric('orders')}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                  activeMetric === 'orders'
                    ? 'bg-purple-500 text-white font-bold shadow-md'
                    : 'text-secondary hover:text-white'
                }`}
              >
                Orders Count
              </button>
            </div>
          </div>

          <div className="relative w-full h-[320px]">
            <Line
              data={lineChartData}
              options={getLineChartOptions(activeMetric === 'revenue')}
            />
          </div>
        </div>

        {/* Secondary Chart: Channel Share */}
        <div className="glass-panel p-6 sm:p-8 rounded-xl border border-outline-variant/20 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-on-background tracking-wide">Purchase Channels</h3>
            <span className="text-[11px] font-mono text-secondary">WebAR vs Shop</span>
          </div>
          <div className="relative w-full h-[250px] flex items-center justify-center my-auto">
            <Doughnut
              data={channelChartData}
              options={getDoughnutChartOptions('orders')}
            />
          </div>
          <div className="pt-4 border-t border-outline-variant/20 grid grid-cols-2 gap-2 text-center text-xs font-mono text-secondary">
            <div>
              <span className="block font-bold text-on-background text-sm">
                {data.channels?.['WebAR Try-on'] || 0}
              </span>
              <span>WebAR Cam</span>
            </div>
            <div>
              <span className="block font-bold text-on-background text-sm">
                {data.channels?.['Curated Shop'] || 0}
              </span>
              <span>Curated Shop</span>
            </div>
          </div>
        </div>
      </section>

      {/* Grid: Recent Orders & Inventory Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity: Real Orders */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-outline-variant/20 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-lg text-on-background tracking-wide">Recent Orders</h3>
              <p className="text-xs text-secondary font-mono">Live customer purchase feed</p>
            </div>
            <Link
              to="/admin/orders"
              className="text-xs font-mono text-primary hover:underline flex items-center gap-1 uppercase tracking-wider"
            >
              <span>View All</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            {data.recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-secondary font-mono text-xs gap-2">
                <span className="material-symbols-outlined text-3xl">shopping_cart</span>
                <span>No order activity logged yet.</span>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/15">
                {data.recentOrders.map((order) => (
                  <div key={order.id} className="py-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.02] px-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-surface-variant flex items-center justify-center flex-shrink-0 border border-outline-variant/30 text-primary">
                        <span className="material-symbols-outlined text-base">receipt</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-on-background">
                            #{order.displayId}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                              order.status === 'paid'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>
                        <p className="text-xs text-secondary truncate mt-0.5">
                          {order.itemSummary} • {order.customer}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="font-mono text-sm font-bold text-on-background block">
                        ${order.total.toFixed(2)}
                      </span>
                      <span className="text-[10px] font-mono text-secondary block">
                        {order.dateFormatted}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Real Inventory Alerts from Firestore */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-outline-variant/20 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-lg text-on-background tracking-wide">Inventory Alerts</h3>
              <p className="text-xs text-secondary font-mono">Stock levels & AR tracking calibration</p>
            </div>
            <Link
              to="/admin/inventory"
              className="text-xs font-mono text-primary hover:underline flex items-center gap-1 uppercase tracking-wider"
            >
              <span>Manage Stock</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
            {data.inventoryAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-4 rounded-xl bg-surface-variant/25 border border-outline-variant/30 hover:border-outline-variant/50 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      alert.type === 'error'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : alert.type === 'warning'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : alert.type === 'success'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {alert.type === 'error'
                        ? 'warning'
                        : alert.type === 'warning'
                        ? 'inventory_2'
                        : alert.type === 'success'
                        ? 'verified'
                        : 'tune'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-on-background text-sm truncate">{alert.title}</p>
                    <p className="text-xs text-secondary truncate mt-0.5">{alert.message}</p>
                    <span
                      className={`inline-block mt-1 text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded ${
                        alert.type === 'error'
                          ? 'bg-rose-500/20 text-rose-300'
                          : alert.type === 'warning'
                          ? 'bg-amber-500/20 text-amber-300'
                          : alert.type === 'success'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-cyan-500/20 text-cyan-300'
                      }`}
                    >
                      {alert.badge}
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0 pl-2">
                  <span className="text-[11px] font-mono text-secondary block">{alert.time}</span>
                  {alert.id !== 'system-optimal' && (
                    <Link
                      to={`/ar-test?batch=${alert.id}`}
                      className="text-[11px] font-mono text-cyan-400 hover:underline mt-1 inline-block"
                    >
                      Calibrate →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
