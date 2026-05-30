import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Mock data to use as a fallback if the database is empty
const MOCK_DATA = {
  totalRevenue: 124500,
  revenueTrend: 12.5,
  totalOrders: 1284,
  ordersTrend: 8.2,
  conversionRate: 3.4,
  conversionTrend: -1.1,
  averageOrderValue: 96.96,
  aovTrend: 4.5,
  salesData: [
    { label: 'Mon', revenue: 18000, orders: 150, height: '40%' },
    { label: 'Tue', revenue: 24000, orders: 190, height: '60%' },
    { label: 'Wed', revenue: 20000, orders: 170, height: '50%' },
    { label: 'Thu', revenue: 32000, orders: 280, height: '80%' },
    { label: 'Fri', revenue: 30000, orders: 260, height: '75%' },
    { label: 'Sat', revenue: 38000, orders: 320, height: '90%' },
    { label: 'Sun', revenue: 26000, orders: 210, height: '65%' },
  ],
  demographics: {
    female: 65,
    male: 25,
    other: 10
  }
};

export const useAnalyticsData = () => {
  const [data, setData] = useState(MOCK_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const ordersRef = collection(db, 'orders');
        const ordersSnapshot = await getDocs(ordersRef);

        if (!ordersSnapshot.empty) {
          let revenue = 0;
          let ordersCount = ordersSnapshot.size;
          
          // Helper to get last 7 days labels
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const today = new Date();
          const last7Days = Array.from({length: 7}, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() - (6 - i));
            return {
              date: d,
              label: days[d.getDay()],
              revenue: 0,
              orders: 0
            };
          });

          ordersSnapshot.forEach((doc) => {
            const data = doc.data();
            revenue += data.total || 0;
            
            // Map to sales data if within last 7 days
            if (data.createdAt) {
              const orderDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
              const dayIndex = last7Days.findIndex(d => 
                d.date.getDate() === orderDate.getDate() && 
                d.date.getMonth() === orderDate.getMonth() && 
                d.date.getFullYear() === orderDate.getFullYear()
              );
              
              if (dayIndex !== -1) {
                last7Days[dayIndex].revenue += data.total || 0;
                last7Days[dayIndex].orders += 1;
              }
            }
          });

          // Use real data where possible, blend with mock data for missing fields
          setData({
            ...MOCK_DATA,
            totalRevenue: revenue,
            totalOrders: ordersCount,
            averageOrderValue: ordersCount > 0 ? revenue / ordersCount : 0,
            salesData: ordersCount > 0 ? last7Days.map(d => ({
              label: d.label,
              revenue: d.revenue,
              orders: d.orders,
              height: '50%' // height will be calculated dynamically in UI now
            })) : MOCK_DATA.salesData
            // Assuming no historical data to calculate trends, keep mock trends
          });
        } else {
           setData(MOCK_DATA);
        }
      } catch (error) {
        console.error("Error fetching analytics data from Firebase:", error);
        // Fallback to mock data is already set in initial state
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  return { data, loading };
};
