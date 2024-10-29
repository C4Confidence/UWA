'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ShoppingBag, User, Star, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

// Mock product data
const product = {
  id: 1,
  name: "Classic Cotton T-Shirt",
  price: 29.99,
  description: "A comfortable and versatile t-shirt made from 100% cotton. Perfect for everyday wear.",
  rating: 4.5,
  reviews: 128,
  images: [
    "/placeholder.svg?height=400&width=400&text=T-Shirt+Front",
    "/placeholder.svg?height=400&width=400&text=T-Shirt+Back",
    "/placeholder.svg?height=400&width=400&text=T-Shirt+Side",
  ],
  sizes: ["XS", "S", "M", "L", "XL"],
  colors: ["White", "Black", "Gray", "Navy"],
}

export default function ProductPage() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const [currentImage, setCurrentImage] = useState(0)
  const [selectedSize, setSelectedSize] = useState("")
  const [selectedColor, setSelectedColor] = useState("")
  const [quantity, setQuantity] = useState(1)

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % product.images.length)
  }

  const prevImage = () => {
    setCurrentImage((prev) => (prev - 1 + product.images.length) % product.images.length)
  }

  const addToCart = () => {
    if (!selectedSize || !selectedColor) {
      alert("Please select a size and color before adding to cart.")
      return
    }
    console.log(`Added to cart: ${quantity} ${selectedColor} ${product.name} in size ${selectedSize}`)
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
              <button type="submit" className="transition-all duration-300 ease-in-out hover:scale-110 hover:bg-green-500 hover:text-white">
                Search
              </button>
            </form>
            <button className="relative">
              <ShoppingBag className="h-6 w-6 text-primary" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
              <span className="sr-only">Cart</span>
            </button>
            <div className="relative" ref={dropdownRef}>
              <button
                className="flex items-center space-x-2"
                onClick={toggleDropdown}
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
              >
                <User className="h-5 w-5" />
                <span className="text-sm font-medium">Welcome</span>
              </button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                  <div className="px-4 py-2">
                    <button className="w-full transition-all duration-300 ease-in-out hover:scale-110 hover:bg-green-500 hover:text-white">
                      Sign In
                    </button>
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
        <div className="grid md:grid-cols-2 gap-8">
          <div className="relative">
            <img
              src={product.images[currentImage]}
              alt={`${product.name} - Image ${currentImage + 1}`}
              className="w-full h-auto rounded-lg shadow-md"
            />
            <button
              className="absolute top-1/2 left-4 transform -translate-y-1/2"
              onClick={prevImage}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              className="absolute top-1/2 right-4 transform -translate-y-1/2"
              onClick={nextImage}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="flex justify-center mt-4 space-x-2">
              {product.images.map((_, index) => (
                <button
                  key={index}
                  className={`w-3 h-3 rounded-full ${
                    index === currentImage ? 'bg-primary' : 'bg-gray-300'
                  }`}
                  onClick={() => setCurrentImage(index)}
                />
              ))}
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
            <div className="flex items-center mb-4">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < Math.floor(product.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="ml-2 text-sm text-gray-600">
                {product.rating} ({product.reviews} reviews)
              </span>
            </div>
            <p className="text-2xl font-bold mb-4">${product.price.toFixed(2)}</p>
            <p className="text-gray-600 mb-6">{product.description}</p>

            {/* Size Selector */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Size</h3>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <label key={size} className={`px-3 py-2 border rounded-md cursor-pointer ${selectedSize === size ? 'bg-primary text-white' : 'bg-white'}`}>
                    <input
                      type="radio"
                      name="size"
                      value={size}
                      className="sr-only"
                      onChange={() => setSelectedSize(size)}
                      checked={selectedSize === size}
                    />
                    {size}
                  </label>
                ))}
              </div>
            </div>

            {/* Color Selector */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Color</h3>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color) => (
                  <label key={color} className={`px-3 py-2 border rounded-md cursor-pointer ${selectedColor === color ? 'bg-primary text-white' : 'bg-white'}`}>
                    <input
                      type="radio"
                      name="color"
                      value={color}
                      className="sr-only"
                      onChange={() => setSelectedColor(color)}
                      checked={selectedColor === color}
                    />
                    {color}
                  </label>
                ))}
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="mb-6">
              <label htmlFor="quantity" className="text-lg font-semibold mb-2">Quantity</label>
              <input
                type="number"
                id="quantity"
                className="w-16 p-2 border border-gray-300 rounded-md"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                min={1}
              />
            </div>

            <button
              className="w-full transition-all duration-300 ease-in-out hover:scale-110 hover:bg-green-500 hover:text-white"
              onClick={addToCart}
            >
              Add to Cart
            </button>
          </div>
        </div>
      </main>

      <footer className="py-4 bg-yellow-300 text-center">
        <p className="text-primary">© {new Date().getFullYear()} Uwa. All rights reserved.</p>
      </footer>
    </div>
  )
}
