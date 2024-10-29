'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, ShoppingBag, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsSubmitted(false)

    try {
      // Simulate API call for password reset
      await new Promise(resolve => setTimeout(resolve, 1000))
      setIsSubmitted(true)
    } catch (err) {
      setError('An error occurred. Please try again.')
    }
  }

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <header className="sticky top-0 z-10 bg-yellow-300 border-b">
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
            <form className="flex items-center space-x-2">
              <input
                type="search"
                placeholder="Search"
                className="w-full sm:w-[200px] md:w-[300px] px-3 py-2 border border-gray-300 rounded-md"
              />
              <Button type="submit" className="transition-all duration-300 ease-in-out hover:scale-110 hover:bg-green-500 hover:text-white">
                Search
              </Button>
            </form>
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingBag className="h-6 w-6 text-primary" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
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
                      Sign In
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

      <div className="flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Forgot your password?
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email-address" className="sr-only">
                  Email address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Reset Password
              </Button>
            </div>
          </form>

          {isSubmitted && (
            <div className="mt-4 p-4 text-green-700 bg-green-100 border border-green-400 rounded">
              <strong>Check your email:</strong> We've sent a password reset link to {email}. Please check your inbox and follow the instructions to reset your password.
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 text-red-700 bg-red-100 border border-red-400 rounded">
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="text-sm text-center">
            <Link
              href="/signin"
              className="font-medium text-primary hover:text-primary-dark flex items-center justify-center"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}