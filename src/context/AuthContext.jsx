import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Helper function to determine if a user has admin or superadmin rights
  const verifyRoles = async (user) => {
    if (!user) return { isSuper: false, isAdmin: false, type: null };

    // 1. Primary email check for system owner (always full superadmin)
    const email = user.email?.toLowerCase();
    if (email === 'brandonrobinson81@gmail.com') {
      return { isSuper: true, isAdmin: true, type: 'superadmin' };
    }

    try {
      // 2. Check Custom Claims in JWT Token
      const tokenResult = await user.getIdTokenResult(true);
      const claims = tokenResult?.claims || {};
      const isClaimSuper = 
        claims.userType === 'superadmin' || 
        claims.role === 'superadmin' || 
        claims.superadmin === true;
      const isClaimAdmin = 
        isClaimSuper ||
        claims.userType === 'admin' || 
        claims.role === 'admin' || 
        claims.admin === true ||
        claims.isAdmin === true;

      if (isClaimSuper) {
        return { isSuper: true, isAdmin: true, type: claims.userType || 'superadmin' };
      }
      if (isClaimAdmin) {
        return { isSuper: false, isAdmin: true, type: claims.userType || 'admin' };
      }

      // 3. Check Firestore 'users' collection (by UID)
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const isDocSuper = 
          data.userType === 'superadmin' || 
          data.role === 'superadmin' || 
          data.isSuperAdmin === true;
        const isDocAdmin = 
          isDocSuper ||
          data.userType === 'admin' || 
          data.role === 'admin' || 
          data.isAdmin === true;

        if (isDocSuper) {
          return { isSuper: true, isAdmin: true, type: data.userType || 'superadmin' };
        }
        if (isDocAdmin) {
          return { isSuper: false, isAdmin: true, type: data.userType || 'admin' };
        }
      }

      // 4. Check Firestore 'users' collection (by email)
      if (email) {
        const emailDocRef = doc(db, 'users', email);
        const emailSnap = await getDoc(emailDocRef);
        if (emailSnap.exists()) {
          const data = emailSnap.data();
          const isDocSuper = 
            data.userType === 'superadmin' || 
            data.role === 'superadmin' || 
            data.isSuperAdmin === true;
          const isDocAdmin = 
            isDocSuper ||
            data.userType === 'admin' || 
            data.role === 'admin' || 
            data.isAdmin === true;

          if (isDocSuper) {
            return { isSuper: true, isAdmin: true, type: data.userType || 'superadmin' };
          }
          if (isDocAdmin) {
            return { isSuper: false, isAdmin: true, type: data.userType || 'admin' };
          }
        }
      }
    } catch (err) {
      console.error('Error verifying admin permissions:', err);
    }

    return { isSuper: false, isAdmin: false, type: 'user' };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const { isSuper, isAdmin: isAdm, type } = await verifyRoles(user);
        setIsSuperAdmin(isSuper);
        setIsAdmin(isAdm);
        setUserType(type);
      } else {
        setCurrentUser(null);
        setIsSuperAdmin(false);
        setIsAdmin(false);
        setUserType(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    setCurrentUser(user);
    const { isSuper, isAdmin: isAdm, type } = await verifyRoles(user);
    setIsSuperAdmin(isSuper);
    setIsAdmin(isAdm);
    setUserType(type);
    return { user, isSuperAdmin: isSuper, isAdmin: isAdm, userType: type };
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setCurrentUser(null);
    setIsSuperAdmin(false);
    setIsAdmin(false);
    setUserType(null);
  };

  const value = {
    currentUser,
    userType,
    isAdmin,
    isSuperAdmin,
    loading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
