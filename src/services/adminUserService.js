import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, firebaseConfig } from '../firebase';

export const PRIMARY_OWNER_EMAIL = 'brandonrobinson81@gmail.com';

/**
 * Fetch all users/admin accounts from Firestore
 */
export const getAdminUsers = async () => {
  try {
    const usersCol = collection(db, 'users');
    const snap = await getDocs(usersCol);
    const users = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      users.push({
        id: docSnap.id,
        ...data
      });
    });

    // Ensure primary owner is always present in list even if not seeded yet
    const hasOwner = users.some(u => (u.email || '').toLowerCase() === PRIMARY_OWNER_EMAIL);
    if (!hasOwner) {
      users.unshift({
        id: PRIMARY_OWNER_EMAIL,
        email: PRIMARY_OWNER_EMAIL,
        displayName: 'System Superadmin (Owner)',
        role: 'superadmin',
        userType: 'superadmin',
        isAdmin: true,
        isSuperAdmin: true,
        isCreator: true,
        isOwner: true,
        createdAt: null
      });
    }

    return users;
  } catch (err) {
    console.error('Error fetching admin users:', err);
    throw err;
  }
};

/**
 * Provisions a new Admin / Creator account
 * Creates Firebase Auth record (using secondary app instance so superadmin isn't signed out)
 * and writes the role document to Firestore /users/{uid} and /users/{email}
 */
export const provisionAdminAccount = async ({ email, password, displayName, role, createdBy }) => {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim() || cleanEmail.split('@')[0];
  const targetRole = (role || 'admin').toLowerCase();

  if (!cleanEmail) throw new Error('Email address is required.');

  let createdUid = null;

  // 1. Create Firebase Auth user if password provided
  if (password && password.length >= 6) {
    const tempAppName = `AdminProvisionApp_${Date.now()}_${Math.random()}`;
    const secondaryApp = initializeApp(firebaseConfig, tempAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
      createdUid = userCredential.user.uid;
      await signOut(secondaryAuth);
    } catch (authErr) {
      // If user already exists in Auth, proceed to update their Firestore role
      if (authErr.code === 'auth/email-already-in-use') {
        console.warn('User already exists in Firebase Auth, updating Firestore role...');
      } else {
        await deleteApp(secondaryApp).catch(() => {});
        throw authErr;
      }
    } finally {
      await deleteApp(secondaryApp).catch(() => {});
    }
  }

  // 2. Build Firestore Role Profile
  const isSuper = targetRole === 'superadmin';
  const isAdm = isSuper || targetRole === 'admin';
  const isCrt = isAdm || targetRole === 'creator' || targetRole === 'creater';

  const userPayload = {
    email: cleanEmail,
    displayName: cleanName,
    role: targetRole,
    userType: targetRole,
    isAdmin: isAdm,
    isSuperAdmin: isSuper,
    isCreator: isCrt,
    createdBy: createdBy || 'superadmin',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (createdUid) {
    userPayload.uid = createdUid;
    // Save by UID
    await setDoc(doc(db, 'users', createdUid), userPayload, { merge: true });
  }

  // Also save by email document key for dual-resolution in AuthContext
  await setDoc(doc(db, 'users', cleanEmail), userPayload, { merge: true });

  return {
    email: cleanEmail,
    displayName: cleanName,
    role: targetRole,
    uid: createdUid
  };
};

/**
 * Updates the role for an existing admin/user
 */
export const updateAdminRole = async (docId, newRole) => {
  const targetRole = newRole.toLowerCase();
  const isSuper = targetRole === 'superadmin';
  const isAdm = isSuper || targetRole === 'admin';
  const isCrt = isAdm || targetRole === 'creator' || targetRole === 'creater';

  const updatePayload = {
    role: targetRole,
    userType: targetRole,
    isAdmin: isAdm,
    isSuperAdmin: isSuper,
    isCreator: isCrt,
    updatedAt: serverTimestamp()
  };

  const userDocRef = doc(db, 'users', docId);
  await updateDoc(userDocRef, updatePayload);
  return updatePayload;
};

/**
 * Removes or revokes an admin account from Firestore
 */
export const removeAdminAccount = async (docId, userEmail) => {
  if (userEmail && userEmail.toLowerCase() === PRIMARY_OWNER_EMAIL) {
    throw new Error('The primary owner account cannot be deleted or revoked.');
  }

  const userDocRef = doc(db, 'users', docId);
  await deleteDoc(userDocRef);

  // If docId is UID, also check if email doc exists
  if (userEmail) {
    try {
      await deleteDoc(doc(db, 'users', userEmail.toLowerCase()));
    } catch (e) {
      // Ignore if not present
    }
  }

  return true;
};
