import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

const CartContext = createContext();

export function useCart() {
  return useContext(CartContext);
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const isInitialLoad = useRef(true);

  // Handle auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        // User logged in: Load from Firestore
        const cartRef = doc(db, 'carts', user.uid);
        const cartSnap = await getDoc(cartRef);
        
        if (cartSnap.exists()) {
          const firestoreCart = cartSnap.data().items || [];
          
          // Optional: merge local storage cart with firestore cart
          const localCartStr = localStorage.getItem('starwear-cart');
          let mergedCart = [...firestoreCart];
          
          if (localCartStr) {
            try {
              const localCart = JSON.parse(localCartStr);
              if (localCart.length > 0) {
                // Merge logic: if item exists, keep firestore or add quantities. Let's just add missing ones.
                localCart.forEach(localItem => {
                  if (!mergedCart.find(item => item.id === localItem.id)) {
                    mergedCart.push(localItem);
                  }
                });
                // Clear local storage since it's merged
                localStorage.removeItem('starwear-cart');
              }
            } catch (e) {
              console.error("Parse error on local cart", e);
            }
          }
          
          setCartItems(mergedCart);
          
          // If we merged, update firestore
          if (localCartStr) {
            await setDoc(cartRef, { items: mergedCart }, { merge: true });
          }

        } else {
          // No cart in firestore, check local storage and push to firestore
          const localCartStr = localStorage.getItem('starwear-cart');
          let initialCart = [];
          if (localCartStr) {
             try {
               initialCart = JSON.parse(localCartStr);
             } catch (e) {}
             localStorage.removeItem('starwear-cart');
          }
          setCartItems(initialCart);
          await setDoc(cartRef, { items: initialCart }, { merge: true });
        }
      } else {
        // User logged out: Load from Local Storage
        const savedCart = localStorage.getItem('starwear-cart');
        if (savedCart) {
          try {
            setCartItems(JSON.parse(savedCart));
          } catch (e) {
            console.error("Could not parse cart data", e);
          }
        } else {
          setCartItems([]);
        }
      }
      isInitialLoad.current = false;
    });

    return () => unsubscribe();
  }, []);

  // Save cart whenever it changes
  useEffect(() => {
    if (isInitialLoad.current) return;

    const saveCart = async () => {
      if (currentUser) {
        // Sync to Firestore
        const cartRef = doc(db, 'carts', currentUser.uid);
        try {
          await setDoc(cartRef, { items: cartItems }, { merge: true });
        } catch (e) {
          console.error("Failed to sync cart to Firestore", e);
        }
      } else {
        // Sync to Local Storage
        localStorage.setItem('starwear-cart', JSON.stringify(cartItems));
      }
    };
    
    saveCart();
  }, [cartItems, currentUser]);

  const addToCart = (product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCartItems(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }
    setCartItems(prev => prev.map(item => 
      item.id === productId ? { ...item, quantity: newQuantity } : item
    ));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getCartCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getCartTotal,
      getCartCount
    }}>
      {children}
    </CartContext.Provider>
  );
}
