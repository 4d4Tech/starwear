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
  const [isCreator, setIsCreator] = useState(false);
  const [loading, setLoading] = useState(true);

  // Helper function to determine if a user has admin, superadmin, or creator rights
  const verifyRoles = async (user) => {
    if (!user) return { isSuper: false, isAdmin: false, isCreator: false, canAccessStudio: false, type: null };

    // 1. Primary email check for system owner (always full superadmin)
    const email = user.email?.toLowerCase();
    if (email === 'brandonrobinson81@gmail.com') {
      return { isSuper: true, isAdmin: true, isCreator: true, canAccessStudio: true, type: 'superadmin' };
    }

    try {
      // 2. Check Custom Claims in JWT Token
      const tokenResult = await user.getIdTokenResult(true);
      const claims = tokenResult?.claims || {};
      const roleClaim = (claims.role || claims.userType || '').toLowerCase();
      const isClaimSuper = roleClaim === 'superadmin' || claims.superadmin === true;
      const isClaimAdmin = isClaimSuper || roleClaim === 'admin' || claims.admin === true || claims.isAdmin === true;
      const isClaimCreator = isClaimAdmin || roleClaim === 'creator' || roleClaim === 'creater' || claims.creator === true || claims.isCreator === true;

      if (isClaimSuper) {
        return { isSuper: true, isAdmin: true, isCreator: true, canAccessStudio: true, canAccessARTest: true, type: 'superadmin' };
      }
      if (isClaimAdmin) {
        return { isSuper: false, isAdmin: true, isCreator: true, canAccessStudio: true, canAccessARTest: true, type: 'admin' };
      }
      if (isClaimCreator) {
        return { isSuper: false, isAdmin: false, isCreator: true, canAccessStudio: false, canAccessARTest: false, type: 'creator' };
      }

      // 3. Check Firestore 'users' collection (by UID)
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const docRole = (data.role || data.userType || '').toLowerCase();
        const isDocSuper = docRole === 'superadmin' || data.isSuperAdmin === true;
        const isDocAdmin = isDocSuper || docRole === 'admin' || data.isAdmin === true;
        const isDocCreator = isDocAdmin || docRole === 'creator' || docRole === 'creater' || data.isCreator === true || data.creator === true;

        if (isDocSuper) {
          return { isSuper: true, isAdmin: true, isCreator: true, canAccessStudio: true, canAccessARTest: true, type: data.userType || 'superadmin' };
        }
        if (isDocAdmin) {
          return { isSuper: false, isAdmin: true, isCreator: true, canAccessStudio: true, canAccessARTest: true, type: data.userType || 'admin' };
        }
        if (isDocCreator) {
          return { isSuper: false, isAdmin: false, isCreator: true, canAccessStudio: false, canAccessARTest: false, type: data.userType || 'creator' };
        }
      }

      // 4. Check Firestore 'users' collection (by email)
      if (email) {
        const emailDocRef = doc(db, 'users', email);
        const emailSnap = await getDoc(emailDocRef);
        if (emailSnap.exists()) {
          const data = emailSnap.data();
          const docRole = (data.role || data.userType || '').toLowerCase();
          const isDocSuper = docRole === 'superadmin' || data.isSuperAdmin === true;
          const isDocAdmin = isDocSuper || docRole === 'admin' || data.isAdmin === true;
          const isDocCreator = isDocAdmin || docRole === 'creator' || docRole === 'creater' || data.isCreator === true || data.creator === true;

          if (isDocSuper) {
            return { isSuper: true, isAdmin: true, isCreator: true, canAccessStudio: true, canAccessARTest: true, type: data.userType || 'superadmin' };
          }
          if (isDocAdmin) {
            return { isSuper: false, isAdmin: true, isCreator: true, canAccessStudio: true, canAccessARTest: true, type: data.userType || 'admin' };
          }
          if (isDocCreator) {
            return { isSuper: false, isAdmin: false, isCreator: true, canAccessStudio: false, canAccessARTest: false, type: data.userType || 'creator' };
          }
        }
      }
    } catch (err) {
      console.error('Error verifying admin permissions:', err);
    }

    return { isSuper: false, isAdmin: false, isCreator: false, canAccessStudio: false, canAccessARTest: false, type: 'user' };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const { isSuper, isAdmin: isAdm, isCreator: isCrt, type } = await verifyRoles(user);
        setIsSuperAdmin(isSuper);
        setIsAdmin(isAdm);
        setIsCreator(isCrt);
        setUserType(type);
      } else {
        setCurrentUser(null);
        setIsSuperAdmin(false);
        setIsAdmin(false);
        setIsCreator(false);
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
    const { isSuper, isAdmin: isAdm, isCreator: isCrt, canAccessStudio: canStudio, type } = await verifyRoles(user);
    setIsSuperAdmin(isSuper);
    setIsAdmin(isAdm);
    setIsCreator(isCrt);
    setUserType(type);
    return { user, isSuperAdmin: isSuper, isAdmin: isAdm, isCreator: isCrt, canAccessStudio: canStudio, userType: type };
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setCurrentUser(null);
    setIsSuperAdmin(false);
    setIsAdmin(false);
    setIsCreator(false);
    setUserType(null);
  };

  // Only authenticated admin users (superadmin or admin) have access to Studio 4D4 and AR-Test
  const canAccessStudio = Boolean(currentUser && (isSuperAdmin || isAdmin));
  const canAccessARTest = Boolean(currentUser && (isSuperAdmin || isAdmin));

  const value = {
    currentUser,
    userType,
    isAdmin,
    isSuperAdmin,
    isCreator,
    canAccessStudio,
    canAccessARTest,
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
