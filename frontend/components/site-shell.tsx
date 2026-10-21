"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { useStore } from "./store-provider";

export function Header() {
  const { cart, account, ready } = useStore();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const path = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    setMenu(false);
    setSearch(false);
  }, [path]);
  useEffect(() => {
    if (search) searchRef.current?.focus();
  }, [search]);
  useEffect(() => {
    if (!menu && !search) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (search) {
          setSearch(false);
          searchButton.current?.focus();
        }
        if (menu) {
          setMenu(false);
          menuButton.current?.focus();
        }
      }
      if (menu && event.key === "Tab" && nav.current) {
        const links = Array.from(
          nav.current.querySelectorAll<HTMLAnchorElement>("a"),
        );
        const first = links[0],
          last = links[links.length - 1];
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          menuButton.current?.focus();
        }
        if (event.shiftKey && document.activeElement === menuButton.current) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === menuButton.current) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menu, search]);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (path === "/admin" || path.startsWith("/admin/")) return null;
  return (
    <>
      <div className="announcement">
        <span>Good finds. Everyday possibilities.</span>
        <Link href="/products">
          Discover the collection <ArrowUpRight size={12} />
        </Link>
      </div>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="wordmark" aria-label="UWA home">
            uwa<span>®</span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            <Link href="/" aria-current={path === "/" ? "page" : undefined}>
              Discover
            </Link>
            <Link
              href="/products"
              aria-current={path.startsWith("/products") ? "page" : undefined}
            >
              Shop all
            </Link>
            <Link
              href="/about"
              aria-current={path === "/about" ? "page" : undefined}
            >
              Our story
            </Link>
          </nav>
          <div className="header-actions">
            <button
              ref={searchButton}
              className="icon-button"
              aria-label={search ? "Close search" : "Open search"}
              aria-expanded={search}
              aria-controls="site-search"
              onClick={() => {
                setSearch(!search);
                setMenu(false);
              }}
            >
              {search ? <X /> : <Search />}
            </button>
            <Link
              href={account ? "/account" : "/signin"}
              className="icon-button account-link"
              aria-label={account ? "Your account" : "Sign in"}
            >
              <UserRound />
            </Link>
            <Link
              href="/cart"
              className="bag-link"
              aria-label={`Shopping Bag, ${ready ? count : 0} ${ready && count === 1 ? "item" : "items"}`}
            >
              <ShoppingBag size={20} />
              <span className="bag-label">Bag</span>
              {" "}
              <span className="bag-count">{ready ? count : 0}</span>
            </Link>
            <button
              ref={menuButton}
              className="icon-button menu-toggle"
              aria-label={menu ? "Close menu" : "Open menu"}
              aria-controls="mobile-menu"
              aria-expanded={menu}
              onClick={() => {
                setMenu(!menu);
                setSearch(false);
              }}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {search && (
          <form
            id="site-search"
            className="search-drawer"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              router.push(`/products?q=${encodeURIComponent(query.trim())}`);
              setSearch(false);
              searchButton.current?.focus();
            }}
          >
            <label htmlFor="global-search">What are you looking for?</label>
            <div>
              <Search size={20} />
              <input
                ref={searchRef}
                id="global-search"
                type="search"
                placeholder="Search the collection…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={150}
              />
              <button type="submit" className="button button-dark">
                Search <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}
        {menu && (
          <nav
            ref={nav}
            id="mobile-menu"
            className="mobile-nav"
            aria-label="Mobile navigation"
          >
            <Link onClick={() => setMenu(false)} href="/">
              Discover <ArrowUpRight />
            </Link>
            <Link onClick={() => setMenu(false)} href="/products">
              Shop all <ArrowUpRight />
            </Link>
            <Link onClick={() => setMenu(false)} href="/about">
              Our story <ArrowUpRight />
            </Link>
            <Link
              onClick={() => setMenu(false)}
              href={account ? "/account" : "/signin"}
            >
              Your account <UserRound />
            </Link>
            <Link onClick={() => setMenu(false)} href="/contact">
              Help & information <ArrowUpRight />
            </Link>
          </nav>
        )}
      </header>
    </>
  );
}

export function Footer() {
  const path = usePathname();
  if (path === "/admin" || path.startsWith("/admin/")) return null;
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <Link
            href="/"
            className="wordmark footer-wordmark"
            aria-label="UWA home"
          >
            uwa<span>®</span>
          </Link>
          <p>
            Good things.
            <br />
            For the way you live.
          </p>
        </div>
        <div className="footer-nav">
          <div>
            <h2>Explore</h2>
            <Link href="/products">The collection</Link>
            <Link href="/about">Our story</Link>
            <Link href="/cart">Your bag</Link>
          </div>
          <div>
            <h2>Here to help</h2>
            <Link href="/contact">Shopping information</Link>
            <Link href="/account">Your account</Link>
            <Link href="/checkout">Checkout availability</Link>
          </div>
        </div>
        <Link className="footer-cta" href="/products">
          <span>
            Find your
            <br /> everyday.
          </span>
          <ArrowUpRight size={38} />
        </Link>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} UWA. All rights reserved.</span>
        <span>A fresh perspective on everyday living.</span>
        <a href="#top">Back to top ↑</a>
      </div>
    </footer>
  );
}
