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
  const [loading, setLoading] = useState(true);

  // Helper function to determine if a user has superadmin rights
  const verifySuperAdmin = async (user) => {
    if (!user) return { isSuper: false, type: null };

    // 1. Primary email check for system owner
    const email = user.email?.toLowerCase();
    if (email === 'brandonrobinson81@gmail.com') {
      return { isSuper: true, type: 'superadmin' };
    }

    try {
      // 2. Check Custom Claims in JWT Token
      const tokenResult = await user.getIdTokenResult(true);
      const claims = tokenResult?.claims || {};
      if (
        claims.userType === 'superadmin' || 
        claims.role === 'superadmin' || 
        claims.superadmin === true
      ) {
        return { isSuper: true, type: claims.userType || 'superadmin' };
      }

      // 3. Check Firestore 'users' collection (by UID)
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (
          data.userType === 'superadmin' || 
          data.role === 'superadmin' || 
          data.isSuperAdmin === true
        ) {
          return { isSuper: true, type: data.userType || 'superadmin' };
        }
      }

      // 4. Check Firestore 'users' collection (by email)
      if (email) {
        const emailDocRef = doc(db, 'users', email);
        const emailSnap = await getDoc(emailDocRef);
        if (emailSnap.exists()) {
          const data = emailSnap.data();
          if (
            data.userType === 'superadmin' || 
            data.role === 'superadmin' || 
            data.isSuperAdmin === true
          ) {
            return { isSuper: true, type: data.userType || 'superadmin' };
          }
        }
      }
    } catch (err) {
      console.error('Error verifying superadmin permissions:', err);
    }

    return { isSuper: false, type: 'user' };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const { isSuper, type } = await verifySuperAdmin(user);
        setIsSuperAdmin(isSuper);
        setUserType(type);
      } else {
        setCurrentUser(null);
        setIsSuperAdmin(false);
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
    const { isSuper, type } = await verifySuperAdmin(user);
    setIsSuperAdmin(isSuper);
    setUserType(type);
    return { user, isSuperAdmin: isSuper, userType: type };
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setCurrentUser(null);
    setIsSuperAdmin(false);
    setUserType(null);
  };

  const value = {
    currentUser,
    userType,
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
