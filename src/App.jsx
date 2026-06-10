import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import StoreFront from './pages/StoreFront';
import ProductDetails from './pages/ProductDetails';
import Collections from './pages/Collections';
import Checkout from './pages/Checkout';
import ShoppingCart from './pages/ShoppingCart';
import OrderSuccess from './pages/OrderSuccess';
import AdminLayout from './components/AdminLayout';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminDashboard from './pages/AdminDashboard';
import AdminInventory from './pages/AdminInventory';
import AdminOrders from './pages/AdminOrders';
import AdminSettings from './pages/AdminSettings';
import SeedDatabase from './pages/SeedDatabase';
import Studio4D4 from './pages/Studio4D4';

// Lazy load AR components to prevent aframe/mind-ar from polluting the global scope on other pages
const ARExperience = lazy(() => import('./pages/ARExperience'));
const ARTest = lazy(() => import('./pages/ARTest'));
const ARExperienceLauncher = lazy(() => import('./pages/ARExperienceLauncher'));

function App() {
  return (
    <Router>
      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-900 text-white">Loading...</div>}>
        <Routes>
          {/* Storefront Routes */}
          <Route path="/" element={<StoreFront />} />
          <Route path="/product" element={<ProductDetails />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/cart" element={<ShoppingCart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/success" element={<OrderSuccess />} />
          <Route path="/seed" element={<SeedDatabase />} />
          <Route path="/ar/:batchId" element={<ARExperience />} />
          <Route path="/ar-test" element={<ARTest />} />
          <Route path="/ar-test-live" element={<ARExperienceLauncher />} />
          <Route path="/studio44" element={<Studio4D4 />} />
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="inventory" element={<AdminInventory />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
