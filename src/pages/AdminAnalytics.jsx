import React, { useState } from 'react';
import { useAnalyticsData } from '../hooks/useAnalyticsData';

const AdminAnalytics = () => {
  const { data, loading } = useAnalyticsData();
  const [chartView, setChartView] = useState('revenue'); // 'revenue' or 'orders'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      {/* Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6">
        <div>
          <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background">Analytics Overview</h2>
          <p className="text-secondary mt-2">Comprehensive insights and performance metrics.</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-outline">calendar_today</span>
            <input className="w-full bg-transparent border-b border-outline-variant focus:border-primary py-2 pl-10 pr-4 text-sm focus:outline-none transition-colors" readOnly type="text" value="Last 30 Days" />
          </div>
          <button onClick={() => alert("Exporting analytics data...")} className="bg-primary text-on-primary px-6 py-2 rounded flex items-center gap-2 hover:opacity-90 transition-opacity font-label-caps text-label-caps">
            <span className="material-symbols-outlined text-[18px]">download</span>
            EXPORT
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter mb-16">
        {/* Revenue */}
        <div className="glass-panel p-6 rounded-lg relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="font-label-caps text-label-caps text-secondary mb-1">TOTAL REVENUE</p>
              <h3 className="font-headline-lg-mobile text-on-background">${data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-full">payments</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={`material-symbols-outlined ${data.revenueTrend >= 0 ? 'text-primary' : 'text-error'} text-[16px]`}>
              {data.revenueTrend >= 0 ? 'trending_up' : 'trending_down'}
            </span>
            <span className={`${data.revenueTrend >= 0 ? 'text-primary' : 'text-error'} font-bold`}>
              {data.revenueTrend > 0 ? '+' : ''}{data.revenueTrend}%
            </span>
            <span className="text-secondary">vs last month</span>
          </div>
        </div>

        {/* Orders */}
        <div className="glass-panel p-6 rounded-lg relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="font-label-caps text-label-caps text-secondary mb-1">TOTAL ORDERS</p>
              <h3 className="font-headline-lg-mobile text-on-background">{data.totalOrders.toLocaleString()}</h3>
            </div>
            <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-full">local_mall</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={`material-symbols-outlined ${data.ordersTrend >= 0 ? 'text-primary' : 'text-error'} text-[16px]`}>
              {data.ordersTrend >= 0 ? 'trending_up' : 'trending_down'}
            </span>
            <span className={`${data.ordersTrend >= 0 ? 'text-primary' : 'text-error'} font-bold`}>
              {data.ordersTrend > 0 ? '+' : ''}{data.ordersTrend}%
            </span>
            <span className="text-secondary">vs last month</span>
          </div>
        </div>

        {/* Conversion */}
        <div className="glass-panel p-6 rounded-lg relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="font-label-caps text-label-caps text-secondary mb-1">CONVERSION RATE</p>
              <h3 className="font-headline-lg-mobile text-on-background">{data.conversionRate}%</h3>
            </div>
            <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-full">swap_horiz</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={`material-symbols-outlined ${data.conversionTrend >= 0 ? 'text-primary' : 'text-error'} text-[16px]`}>
              {data.conversionTrend >= 0 ? 'trending_up' : 'trending_down'}
            </span>
            <span className={`${data.conversionTrend >= 0 ? 'text-primary' : 'text-error'} font-bold`}>
              {data.conversionTrend > 0 ? '+' : ''}{data.conversionTrend}%
            </span>
            <span className="text-secondary">vs last month</span>
          </div>
        </div>

        {/* AOV */}
        <div className="glass-panel p-6 rounded-lg relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="font-label-caps text-label-caps text-secondary mb-1">AVG ORDER VALUE</p>
              <h3 className="font-headline-lg-mobile text-on-background">${data.averageOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-full">receipt_long</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={`material-symbols-outlined ${data.aovTrend >= 0 ? 'text-primary' : 'text-error'} text-[16px]`}>
              {data.aovTrend >= 0 ? 'trending_up' : 'trending_down'}
            </span>
            <span className={`${data.aovTrend >= 0 ? 'text-primary' : 'text-error'} font-bold`}>
              {data.aovTrend > 0 ? '+' : ''}{data.aovTrend}%
            </span>
            <span className="text-secondary">vs last month</span>
          </div>
        </div>
      </section>

      {/* Charts Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Main Chart */}
        <div className="glass-panel p-8 rounded-lg lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold text-lg text-on-background">Sales Trends</h3>
            <div className="flex gap-4">
              <button 
                onClick={() => setChartView('revenue')}
                className={`font-label-caps text-label-caps pb-1 transition-colors ${chartView === 'revenue' ? 'text-primary border-b-2 border-primary' : 'text-secondary hover:text-primary'}`}
              >
                REVENUE
              </button>
              <button 
                onClick={() => setChartView('orders')}
                className={`font-label-caps text-label-caps pb-1 transition-colors ${chartView === 'orders' ? 'text-primary border-b-2 border-primary' : 'text-secondary hover:text-primary'}`}
              >
                ORDERS
              </button>
            </div>
          </div>
          {/* Abstract Chart Placeholder using CSS Gradients/Shapes to simulate a minimalist area chart */}
          <div className="flex-1 relative w-full min-h-[300px] border-b border-l border-outline-variant/30 flex items-end pt-8">
            {/* Y Axis Labels */}
            <div className="absolute left-[-40px] top-0 bottom-0 flex flex-col justify-between text-xs text-secondary py-2">
              {chartView === 'revenue' ? (
                <>
                  <span>${(Math.max(...data.salesData.map(d => d.revenue), 50000) / 1000).toFixed(0)}k</span>
                  <span>${(Math.max(...data.salesData.map(d => d.revenue), 50000) * 0.8 / 1000).toFixed(0)}k</span>
                  <span>${(Math.max(...data.salesData.map(d => d.revenue), 50000) * 0.6 / 1000).toFixed(0)}k</span>
                  <span>${(Math.max(...data.salesData.map(d => d.revenue), 50000) * 0.4 / 1000).toFixed(0)}k</span>
                  <span>${(Math.max(...data.salesData.map(d => d.revenue), 50000) * 0.2 / 1000).toFixed(0)}k</span>
                  <span>$0</span>
                </>
              ) : (
                <>
                  <span>{Math.max(...data.salesData.map(d => d.orders), 500)}</span>
                  <span>{Math.round(Math.max(...data.salesData.map(d => d.orders), 500) * 0.8)}</span>
                  <span>{Math.round(Math.max(...data.salesData.map(d => d.orders), 500) * 0.6)}</span>
                  <span>{Math.round(Math.max(...data.salesData.map(d => d.orders), 500) * 0.4)}</span>
                  <span>{Math.round(Math.max(...data.salesData.map(d => d.orders), 500) * 0.2)}</span>
                  <span>0</span>
                </>
              )}
            </div>
            {/* Chart Area Simulation */}
            <div className="relative w-full h-full flex items-end justify-between px-4 pb-2">
              {/* Bars/Points */}
              {data.salesData.map((item, index) => {
                const value = chartView === 'revenue' ? item.revenue : item.orders;
                const maxValue = chartView === 'revenue' 
                  ? Math.max(...data.salesData.map(d => d.revenue), 50000) 
                  : Math.max(...data.salesData.map(d => d.orders), 500);
                const heightPercentage = `${Math.max((value / maxValue) * 100, 2)}%`; // Ensure min height of 2%
                
                return (
                  <div key={index} className="w-1/12 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t relative group cursor-pointer" style={{ height: heightPercentage }}>
                    <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-xs py-1 px-2 rounded whitespace-nowrap z-10">
                      {chartView === 'revenue' ? `$${(value / 1000).toFixed(0)}k` : `${value} orders`}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* X Axis Labels */}
            <div className="absolute -bottom-8 left-0 right-0 flex justify-between px-4 text-xs text-secondary">
              {data.salesData.map((item, index) => (
                <span key={index}>{item.label}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Demographics / secondary chart */}
        <div className="glass-panel p-8 rounded-lg flex flex-col">
          <h3 className="font-bold text-lg text-on-background mb-8">Customer Demographics</h3>
          <div className="flex-1 flex flex-col justify-center">
            {/* Donut Chart Simulation */}
            <div className="relative w-48 h-48 mx-auto mb-8 rounded-full border-[16px] border-surface-variant flex items-center justify-center">
              <div className="absolute inset-[-16px] rounded-full border-[16px] border-primary" style={{clipPath: "polygon(50% 50%, 100% 0, 100% 100%, 0 100%, 0 50%)"}}></div>
              <div className="absolute inset-[-16px] rounded-full border-[16px] border-primary-container" style={{clipPath: "polygon(50% 50%, 0 50%, 0 0, 50% 0)"}}></div>
              <div className="text-center">
                <span className="block font-headline-lg-mobile text-on-background">{data.demographics.female}%</span>
                <span className="text-xs text-secondary font-label-caps">FEMALE</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary"></div>
                  <span className="text-sm">Female</span>
                </div>
                <span className="font-bold">{data.demographics.female}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary-container"></div>
                  <span className="text-sm">Male</span>
                </div>
                <span className="font-bold">{data.demographics.male}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-surface-variant"></div>
                  <span className="text-sm">Other/Unspecified</span>
                </div>
                <span className="font-bold">{data.demographics.other}%</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default AdminAnalytics;
