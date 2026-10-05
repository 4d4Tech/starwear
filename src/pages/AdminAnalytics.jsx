import React, { useState } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import {
  formatCurrency,
  getLineChartOptions,
  getBarChartOptions,
  getDoughnutChartOptions,
  createGradient
} from '../utils/chartConfig';

const AdminAnalytics = () => {
  const [chartView, setChartView] = useState('revenue'); // 'revenue' | 'orders' | 'dual'
  const { data, loading, error, timeRange, setTimeRange, refresh, exportDataAsCsv } = useAnalyticsData('30d');

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="font-mono text-xs text-secondary tracking-widest uppercase">Aggregating Business Intelligence...</p>
      </div>
    );
  }

  // 1. Main Line Chart: Sales Trends (Revenue / Orders / Dual)
  const lineChartData = {
    labels: data.chartDatasets?.labels || [],
    datasets: chartView === 'dual'
      ? [
          {
            label: 'Revenue ($)',
            data: data.chartDatasets?.revenue || [],
            borderColor: '#38bdf8',
            backgroundColor: (context) => {
              const ctx = context.chart.ctx;
              return createGradient(ctx, 'rgba(56, 189, 248, 0.28)', 'rgba(56, 189, 248, 0.0)');
            },
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
            yAxisID: 'y',
            pointBackgroundColor: '#38bdf8',
            pointBorderColor: '#0b0f19',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Orders Count',
            data: data.chartDatasets?.orders || [],
            borderColor: '#a855f7',
            backgroundColor: (context) => {
              const ctx = context.chart.ctx;
              return createGradient(ctx, 'rgba(168, 85, 247, 0.2)', 'rgba(168, 85, 247, 0.0)');
            },
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.35,
            fill: false,
            yAxisID: 'y1',
            pointBackgroundColor: '#a855f7',
            pointBorderColor: '#0b0f19',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      : [
          chartView === 'revenue'
            ? {
                label: 'Revenue ($)',
                data: data.chartDatasets?.revenue || [],
                borderColor: '#38bdf8',
                backgroundColor: (context) => {
                  const ctx = context.chart.ctx;
                  return createGradient(ctx, 'rgba(56, 189, 248, 0.35)', 'rgba(56, 189, 248, 0.0)');
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
                  return createGradient(ctx, 'rgba(168, 85, 247, 0.35)', 'rgba(168, 85, 247, 0.0)');
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

  // Dual axis options for line chart
  const mainLineOptions = {
    ...getLineChartOptions(chartView !== 'orders'),
    scales: chartView === 'dual'
      ? {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#94a3b8', font: { size: 11 } },
            border: { display: false }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            ticks: {
              color: '#38bdf8',
              font: { size: 11 },
              callback: (val) => `$${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`
            },
            border: { display: false }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              color: '#a855f7',
              font: { size: 11 }
            },
            border: { display: false }
          }
        }
      : getLineChartOptions(chartView !== 'orders').scales
  };

  // 2. Channel Distribution Doughnut Chart
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

  // 3. Top Products Horizontal Bar Chart
  const topProductsLabels = data.topProducts.map(p => p.name.length > 18 ? p.name.substring(0, 18) + '...' : p.name);
  const topProductsChartData = {
    labels: topProductsLabels,
    datasets: [
      {
        label: 'Revenue ($)',
        data: data.topProducts.map(p => p.revenue),
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          return createGradient(ctx, '#38bdf8', '#0284c7');
        },
        borderRadius: 6,
        borderSkipped: false
      }
    ]
  };

  // 4. Order Status Distribution Chart
  const statusLabels = Object.keys(data.statusBreakdown || {});
  const statusChartData = {
    labels: statusLabels,
    datasets: [
      {
        data: Object.values(data.statusBreakdown || {}),
        backgroundColor: [
          '#10b981', // Paid (Emerald)
          '#f59e0b', // Pending (Amber)
          '#3b82f6'  // Processing (Blue)
        ],
        borderColor: '#0b0f19',
        borderWidth: 2
      }
    ]
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-outline-variant/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-sm text-primary">insights</span>
            <span className="font-mono text-xs text-primary tracking-widest uppercase">Business Intelligence</span>
          </div>
          <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background font-bold tracking-tight">
            Analytics Overview
          </h2>
          <p className="text-secondary text-sm mt-1">Real-time revenue telemetry, conversion metrics, and sales channels.</p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Interactive Date Range Selector */}
          <div className="relative">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-surface-variant/40 border border-outline-variant/40 text-on-background text-xs font-mono py-2.5 pl-3 pr-8 rounded-lg focus:outline-none focus:border-primary cursor-pointer transition-colors"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="ytd">Year to Date (YTD)</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={refresh}
            className="p-2.5 rounded-lg border border-outline-variant/40 hover:border-primary/50 text-secondary hover:text-white transition-colors cursor-pointer"
            title="Refresh Data from Firestore"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={exportDataAsCsv}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-all text-xs font-mono shadow-md cursor-pointer active:scale-95"
            title="Export filtered orders to CSV"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>EXPORT CSV</span>
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
        <div className="glass-panel p-6 rounded-xl border border-outline-variant/20 hover:border-primary/40 transition-all shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="font-label-caps text-xs text-secondary tracking-widest uppercase">TOTAL REVENUE</span>
            <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-full text-base">
              payments
            </span>
          </div>
          <div className="font-headline-lg text-3xl sm:text-4xl text-on-background font-bold tracking-tight mb-2">
            {formatCurrency(data.totalRevenue, 2)}
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span
              className={`flex items-center font-bold ${
                data.revenueTrend >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {data.revenueTrend >= 0 ? 'trending_up' : 'trending_down'}
              </span>
              <span>
                {data.revenueTrend >= 0 ? '+' : ''}
                {data.revenueTrend}%
              </span>
            </span>
            <span className="text-secondary">vs previous period</span>
          </div>
        </div>

        {/* Total Orders */}
        <div className="glass-panel p-6 rounded-xl border border-outline-variant/20 hover:border-primary/40 transition-all shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="font-label-caps text-xs text-secondary tracking-widest uppercase">TOTAL ORDERS</span>
            <span className="material-symbols-outlined text-purple-400 bg-purple-500/10 p-2 rounded-full text-base">
              local_mall
            </span>
          </div>
          <div className="font-headline-lg text-3xl sm:text-4xl text-on-background font-bold tracking-tight mb-2">
            {data.totalOrders.toLocaleString()}
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span
              className={`flex items-center font-bold ${
                data.ordersTrend >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {data.ordersTrend >= 0 ? 'trending_up' : 'trending_down'}
              </span>
              <span>
                {data.ordersTrend >= 0 ? '+' : ''}
                {data.ordersTrend}%
              </span>
            </span>
            <span className="text-secondary">vs previous period</span>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="glass-panel p-6 rounded-xl border border-outline-variant/20 hover:border-primary/40 transition-all shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="font-label-caps text-xs text-secondary tracking-widest uppercase">CONVERSION RATE</span>
            <span className="material-symbols-outlined text-amber-400 bg-amber-500/10 p-2 rounded-full text-base">
              swap_horiz
            </span>
          </div>
          <div className="font-headline-lg text-3xl sm:text-4xl text-on-background font-bold tracking-tight mb-2">
            {data.conversionRate}%
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span
              className={`flex items-center font-bold ${
                data.conversionTrend >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {data.conversionTrend >= 0 ? 'trending_up' : 'trending_down'}
              </span>
              <span>
                {data.conversionTrend >= 0 ? '+' : ''}
                {data.conversionTrend}%
              </span>
            </span>
            <span className="text-secondary">vs previous period</span>
          </div>
        </div>

        {/* Average Order Value */}
        <div className="glass-panel p-6 rounded-xl border border-outline-variant/20 hover:border-primary/40 transition-all shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="font-label-caps text-xs text-secondary tracking-widest uppercase">AVG ORDER VALUE</span>
            <span className="material-symbols-outlined text-emerald-400 bg-emerald-500/10 p-2 rounded-full text-base">
              receipt_long
            </span>
          </div>
          <div className="font-headline-lg text-3xl sm:text-4xl text-on-background font-bold tracking-tight mb-2">
            {formatCurrency(data.averageOrderValue, 2)}
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span
              className={`flex items-center font-bold ${
                data.aovTrend >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {data.aovTrend >= 0 ? 'trending_up' : 'trending_down'}
              </span>
              <span>
                {data.aovTrend >= 0 ? '+' : ''}
                {data.aovTrend}%
              </span>
            </span>
            <span className="text-secondary">vs previous period</span>
          </div>
        </div>
      </section>

      {/* Main Chart.js Interactive Graph */}
      <section className="glass-panel p-6 sm:p-8 rounded-xl border border-outline-variant/20 shadow-sm flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="font-bold text-lg text-on-background tracking-wide">Sales & Order Trends</h3>
            <p className="text-xs text-secondary font-mono mt-0.5">Chart.js dynamic visual timeline</p>
          </div>

          {/* Metric Selector Toggle */}
          <div className="flex items-center gap-1.5 bg-surface-variant/40 p-1 rounded-lg border border-outline-variant/30 text-xs font-mono">
            <button
              type="button"
              onClick={() => setChartView('revenue')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                chartView === 'revenue'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                  : 'text-secondary hover:text-white'
              }`}
            >
              Revenue ($)
            </button>
            <button
              type="button"
              onClick={() => setChartView('orders')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                chartView === 'orders'
                  ? 'bg-purple-500 text-white font-bold shadow-md'
                  : 'text-secondary hover:text-white'
              }`}
            >
              Orders Count
            </button>
            <button
              type="button"
              onClick={() => setChartView('dual')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                chartView === 'dual'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-secondary hover:text-white'
              }`}
            >
              Dual Comparison
            </button>
          </div>
        </div>

        <div className="relative w-full h-[360px]">
          <Line data={lineChartData} options={mainLineOptions} />
        </div>
      </section>

      {/* Multi-Chart Analytics Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Channels Doughnut */}
        <div className="glass-panel p-6 sm:p-8 rounded-xl border border-outline-variant/20 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-base text-on-background tracking-wide">Sales by Channel</h3>
            <span className="text-[11px] font-mono text-secondary">WebAR vs Shop</span>
          </div>
          <div className="relative w-full h-[240px] flex items-center justify-center my-auto">
            <Doughnut data={channelChartData} options={getDoughnutChartOptions('orders')} />
          </div>
          <div className="pt-4 border-t border-outline-variant/20 text-xs font-mono text-secondary flex justify-between">
            <span>Direct WebAR Try-on:</span>
            <span className="font-bold text-cyan-400">{data.channels?.['WebAR Try-on'] || 0}</span>
          </div>
        </div>

        {/* Chart 2: Top Selling Products Bar Chart */}
        <div className="glass-panel p-6 sm:p-8 rounded-xl border border-outline-variant/20 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-base text-on-background tracking-wide">Top Products</h3>
            <span className="text-[11px] font-mono text-secondary">By Revenue</span>
          </div>
          <div className="relative w-full h-[240px]">
            <Bar data={topProductsChartData} options={getBarChartOptions(true, true)} />
          </div>
          <div className="pt-4 border-t border-outline-variant/20 text-xs font-mono text-secondary flex justify-between">
            <span>Top Asset:</span>
            <span className="font-bold text-on-background truncate max-w-[160px]">
              {data.topProducts[0]?.name || 'N/A'}
            </span>
          </div>
        </div>

        {/* Chart 3: Order Status & Fulfillment */}
        <div className="glass-panel p-6 sm:p-8 rounded-xl border border-outline-variant/20 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-base text-on-background tracking-wide">Order Status</h3>
            <span className="text-[11px] font-mono text-secondary">Fulfillment</span>
          </div>
          <div className="relative w-full h-[240px] flex items-center justify-center my-auto">
            <Doughnut data={statusChartData} options={getDoughnutChartOptions('orders')} />
          </div>
          <div className="pt-4 border-t border-outline-variant/20 text-xs font-mono text-secondary flex justify-between">
            <span>Verified Paid:</span>
            <span className="font-bold text-emerald-400">{data.paidOrdersCount}</span>
          </div>
        </div>
      </section>

      {/* Granular Timeline Breakdown Table */}
      <section className="glass-panel rounded-xl border border-outline-variant/20 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-outline-variant/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="font-bold text-base text-on-background tracking-wide">Timeline Breakdown</h3>
            <p className="text-xs text-secondary font-mono">Period telemetry table</p>
          </div>
          <span className="text-xs font-mono text-secondary px-2.5 py-1 rounded bg-surface-variant/40 border border-outline-variant/30">
            {data.salesData.length} Interval Intervals
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-outline-variant/20 text-secondary bg-surface-variant/20">
                <th className="py-3 px-6 font-semibold">DATE INTERVAL</th>
                <th className="py-3 px-6 font-semibold">ORDERS</th>
                <th className="py-3 px-6 font-semibold">REVENUE</th>
                <th className="py-3 px-6 font-semibold">AVG BASKET</th>
                <th className="py-3 px-6 font-semibold text-right">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15 text-on-background">
              {data.salesData.map((row, index) => {
                const aov = row.orders > 0 ? row.revenue / row.orders : 0;
                return (
                  <tr key={index} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-6 font-bold">{row.label}</td>
                    <td className="py-3 px-6">{row.orders} orders</td>
                    <td className="py-3 px-6 font-bold text-cyan-400">{formatCurrency(row.revenue, 2)}</td>
                    <td className="py-3 px-6 text-secondary">{formatCurrency(aov, 2)}</td>
                    <td className="py-3 px-6 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.revenue > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-surface-variant text-secondary'
                      }`}>
                        {row.revenue > 0 ? 'ACTIVE' : 'IDLE'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AdminAnalytics;
