import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const PaymentEnvironmentContext = createContext();

export const usePaymentEnvironment = () => {
  const context = useContext(PaymentEnvironmentContext);
  if (!context) {
    throw new Error('usePaymentEnvironment must be used within a PaymentEnvironmentProvider');
  }
  return context;
};

export const PaymentEnvironmentProvider = ({ children }) => {
  const { isAdmin, isSuperAdmin, currentUser } = useAuth();

  // Admin selected environment ('sandbox' | 'live')
  const [adminSettingEnv, setAdminSettingEnv] = useState(() => {
    return localStorage.getItem('star_wear_payment_env') || 'live';
  });

  // Admin selected active payment gateway ('paypal' | 'stripe' | 'both')
  const [activeGateway, setActiveGateway] = useState(() => {
    return localStorage.getItem('star_wear_active_gateway') || 'paypal';
  });

  const [loading, setLoading] = useState(true);

  // Fetch persisted payment environment and gateway from Firestore
  useEffect(() => {
    let isMounted = true;
    async function loadSetting() {
      try {
        const docRef = doc(db, 'settings', 'payments');
        const snap = await getDoc(docRef);
        if (snap.exists() && isMounted) {
          const data = snap.data();
          if (data.environment) {
            setAdminSettingEnv(data.environment);
            localStorage.setItem('star_wear_payment_env', data.environment);
          }
          if (data.activeGateway) {
            setActiveGateway(data.activeGateway);
            localStorage.setItem('star_wear_active_gateway', data.activeGateway);
          }
        }
      } catch (err) {
        console.warn('Failed to load payment settings from Firestore:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadSetting();
    return () => { isMounted = false; };
  }, []);

  // CRITICAL RULE:
  // Only admin accounts can ever have sandbox mode active.
  // Every other user, including guests, stays strictly in live mode.
  const isUserAdmin = Boolean(isAdmin || isSuperAdmin);
  const isSandboxMode = isUserAdmin && adminSettingEnv === 'sandbox';
  const effectiveEnvironment = isSandboxMode ? 'sandbox' : 'live';

  const isPayPalEnabled = activeGateway === 'paypal' || activeGateway === 'both';
  const isStripeEnabled = activeGateway === 'stripe' || activeGateway === 'both';

  const togglePaymentEnvironment = async (newEnv) => {
    if (!isUserAdmin) {
      console.warn('Unauthorized: Only admin accounts can toggle payment environment.');
      return false;
    }

    const targetEnv = (newEnv === 'sandbox' || newEnv === 'live')
      ? newEnv
      : (adminSettingEnv === 'sandbox' ? 'live' : 'sandbox');

    setAdminSettingEnv(targetEnv);
    localStorage.setItem('star_wear_payment_env', targetEnv);

    try {
      await setDoc(doc(db, 'settings', 'payments'), {
        environment: targetEnv,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || 'admin'
      }, { merge: true });
    } catch (err) {
      console.error('Error saving payment environment to Firestore:', err);
    }
    return true;
  };

  const setActivePaymentGateway = async (gateway) => {
    if (!isUserAdmin) {
      console.warn('Unauthorized: Only admin accounts can change payment gateway.');
      return false;
    }

    const targetGateway = ['paypal', 'stripe', 'both'].includes(gateway) ? gateway : 'paypal';
    setActiveGateway(targetGateway);
    localStorage.setItem('star_wear_active_gateway', targetGateway);

    try {
      await setDoc(doc(db, 'settings', 'payments'), {
        activeGateway: targetGateway,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || 'admin'
      }, { merge: true });
    } catch (err) {
      console.error('Error saving active gateway to Firestore:', err);
    }
    return true;
  };

  const value = {
    adminSettingEnv,
    activeGateway,
    isPayPalEnabled,
    isStripeEnabled,
    setActivePaymentGateway,
    isSandboxMode,
    isLiveMode: !isSandboxMode,
    effectiveEnvironment,
    togglePaymentEnvironment,
    isUserAdmin,
    loading
  };

  return (
    <PaymentEnvironmentContext.Provider value={value}>
      {children}
    </PaymentEnvironmentContext.Provider>
  );
};
