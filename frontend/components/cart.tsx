'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ShoppingBag, User, Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

// Mock cart data
const initialCartItems = [
  { id: 1, name: "Bluetooth Speakers", price: 29.99, quantity: 2 },
  { id: 2, name: "Irons", price: 59.99, quantity: 1 },
  { id: 3, name: "Phones", price: 89.99, quantity: 1 },
]

export default function CartPage() {
  const [cartItems, setCartItems] = useState(initialCartItems)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0)
  }

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2)
  }

  const updateQuantity = (id: number, change: number) => {
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, quantity: Math.max(0, item.quantity + change) } : item
      ).filter(item => item.quantity > 0)
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <header className="sticky top-0 z-10 bg-yellow-400 border-b">
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-2xl font-bold text-primary">
            Uwa
          </Link>
          <nav className="order-3 w-full md:w-auto md:order-none">
            <ul className="flex space-x-4 justify-center md:justify-start">
              <li>
                <Link href="/products" className="text-primary hover:text-primary-foreground">
                  Products
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-primary hover:text-primary-foreground">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-primary hover:text-primary-foreground">
                  Contact
                </Link>
              </li>
            </ul>
          </nav>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingBag className="h-6 w-6 text-primary" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">{getTotalItems()}</span>
              <span className="sr-only">Cart</span>
            </Button>
            <div className="relative" ref={dropdownRef}>
              <Button
                variant="ghost"
                className="flex items-center space-x-2"
                onClick={toggleDropdown}
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
              >
                <User className="h-5 w-5" />
                <span className="text-sm font-medium">Welcome</span>
              </Button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                  <div className="px-4 py-2">
                    <Button className="w-full transition-all duration-300 ease-in-out hover:scale-110 hover:bg-green-500 hover:text-white">
                      <Link href="/signin">
                        Sign In
                      </Link>
                    </Button>
                    <p className="mt-2 text-sm text-center">
                      New Customer?{' '}
                      <Link href="/signup" className="text-blue-500 hover:underline">
                        Sign up
                      </Link>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Your Cart</h1>
        {cartItems.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-gray-500">Your cart is empty</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {cartItems.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle>{item.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <p className="text-lg font-semibold">${item.price.toFixed(2)}</p>
                    <div className="flex items-center space-x-2">
                      <Button size="icon" variant="outline" onClick={() => updateQuantity(item.id, -1)}>
                        <Minus className="h-4 w-4" />
                        <span className="sr-only">Decrease quantity</span>
                      </Button>
                      <span className="text-lg font-semibold">{item.quantity}</span>
                      <Button size="icon" variant="outline" onClick={() => updateQuantity(item.id, 1)}>
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">Increase quantity</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="destructive" className="ml-auto" onClick={() => updateQuantity(item.id, -item.quantity)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </CardFooter>
              </Card>
            ))}
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center">
                  <p className="text-xl font-bold">Total:</p>
                  <p className="text-xl font-bold">${getTotalPrice()}</p>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full transition-all duration-300 ease-in-out hover:scale-105 hover:bg-green-500 hover:text-white">
                  Proceed to Checkout
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </main>

      <footer className="bg-muted mt-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Uwa. All rights reserved.</p>
            <nav>
              <ul className="flex space-x-4">
                <li>
                  <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary">
                    Privacy
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}