"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Account, CartItem, Product } from "@/lib/types";
import { isProduct } from "@/lib/api";

interface Store {
  cart: CartItem[];
  account: Account | null;
  ready: boolean;
  notice: string;
  addToCart: (product: Product, quantity?: number) => boolean;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  signIn: (account: Account) => void;
  signOut: () => Promise<void>;
}
const StoreContext = createContext<Store | null>(null);
const CART_KEY = "uwa.cart.v1";
const ACCOUNT_KEY = "uwa.account.v1";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      if (Array.isArray(saved))
        setCart(
          saved.filter(
            (item): item is CartItem =>
              !!item &&
              isProduct(item.product) &&
              Number.isInteger(item.quantity) &&
              item.quantity > 0 &&
              item.quantity <= item.product.quantity,
          ),
        );
      const user: unknown = JSON.parse(
        sessionStorage.getItem(ACCOUNT_KEY) || "null",
      );
      if (
        user &&
        typeof user === "object" &&
        "_id" in user &&
        typeof user._id === "string" &&
        "firstname" in user &&
        typeof user.firstname === "string" &&
        "lastname" in user &&
        typeof user.lastname === "string" &&
        "email" in user &&
        typeof user.email === "string" &&
        "token" in user &&
        typeof user.token === "string"
      ) {
        const token = user.token.split(".")[1];
        const payload = JSON.parse(
          atob(token.replace(/-/g, "+").replace(/_/g, "/")),
        );
        if (typeof payload.exp === "number" && payload.exp * 1000 > Date.now())
          setAccount(user as Account);
      }
    } catch {
      /* Missing or restricted browser storage must not block shopping. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* Keep the cart in memory. */
    }
  }, [cart, ready]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  const addToCart = useCallback(
    (product: Product, quantity = 1) => {
      if (
        !isProduct(product) ||
        product.quantity < 1 ||
        !Number.isInteger(quantity) ||
        quantity < 1
      )
        return false;
      const existing = cart.find((item) => item.product._id === product._id);
      if ((existing?.quantity || 0) >= product.quantity) {
        setNotice(`Your bag already has all available ${product.title}.`);
        return false;
      }
      setCart((items) => {
        const existing = items.find((item) => item.product._id === product._id);
        const next = Math.min(
          product.quantity,
          (existing?.quantity || 0) + quantity,
        );
        return existing
          ? items.map((item) =>
              item.product._id === product._id
                ? { product, quantity: next }
                : item,
            )
          : [...items, { product, quantity: next }];
      });
      setNotice(`${product.title} added to your bag.`);
      return true;
    },
    [cart],
  );
  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (!Number.isInteger(quantity)) return;
    setCart((items) =>
      items.map((item) =>
        item.product._id === id
          ? {
              ...item,
              quantity: Math.max(1, Math.min(quantity, item.product.quantity)),
            }
          : item,
      ),
    );
  }, []);
  const removeFromCart = useCallback(
    (id: string) =>
      setCart((items) => items.filter((item) => item.product._id !== id)),
    [],
  );
  const clearCart = useCallback(() => setCart([]), []);
  const signIn = useCallback((user: Account) => {
    setAccount(user);
    try {
      sessionStorage.setItem(ACCOUNT_KEY, JSON.stringify(user));
    } catch {
      /* Account remains in memory. */
    }
  }, []);
  const signOut = useCallback(async () => {
    setAccount(null);
    try {
      sessionStorage.removeItem(ACCOUNT_KEY);
    } catch {
      /* Restricted storage. */
    }
    try {
      await fetch("/api/user/logout", {
        credentials: "same-origin",
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      /* Local session has still been removed. */
    }
    setNotice("You’ve signed out on this device.");
  }, []);
  const value = useMemo(
    () => ({
      cart,
      account,
      ready,
      notice,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      signIn,
      signOut,
    }),
    [
      cart,
      account,
      ready,
      notice,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      signIn,
      signOut,
    ],
  );
  return (
    <StoreContext.Provider value={value}>
      {children}
      <div
        className={`toast ${notice ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("StoreProvider is required.");
  return store;
}
