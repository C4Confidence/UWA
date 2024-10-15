'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ShoppingBag, User, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
// import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'

const images = [
  '/placeholder.svg?height=400&width=800&text=Image+1',
  '/placeholder.svg?height=400&width=800&text=Image+2',
  '/placeholder.svg?height=400&width=800&text=Image+3',
  '/placeholder.svg?height=400&width=800&text=Image+4',
  '/placeholder.svg?height=400&width=800&text=Image+5',
  '/placeholder.svg?height=400&width=800&text=Image+6',
]

export default function Home() {
  const [currentImage, setCurrentImage] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prevImage) => (prevImage + 1) % images.length)
    }, 3000)

    return () => clearInterval(timer)
  }, [])

  const goToImage = (index: number) => {
    setCurrentImage(index)
  }

  const goToPrevious = () => {
    setCurrentImage((prevImage) => (prevImage - 1 + images.length) % images.length)
  }

  const goToNext = () => {
    setCurrentImage((prevImage) => (prevImage + 1) % images.length)
  }

  return (
    <div className="flex flex-col min-h-screen">
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
                className="w-full sm:w-[200px] md:w-[300px]"
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
            <div className="relative group">
              <Button variant="ghost" className="p-0">
                <User className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Welcome</span>
              </Button>
              <div className="absolute right-0 mt-2 w-48 bg-background shadow-lg rounded-md overflow-hidden z-10 invisible group-hover:visible">
                <div className="p-4">
                  <Button className="w-full mb-2 transition-all duration-300 ease-in-out hover:scale-105 hover:bg-green-500 hover:text-white">
                    Sign In
                  </Button>
                  <p className="text-sm text-center">
                    New Customer?{' '}
                    <Link href="/signup" className="text-primary hover:underline">
                      Sign up
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <section className="relative overflow-hidden" aria-label="Hero Carousel">
          <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${currentImage * 100}%)` }}>
            {images.map((src, index) => (
              <img key={index} src={src} alt={`Carousel Image ${index + 1}`} className="w-full h-[400px] object-cover flex-shrink-0" />
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-white/80 hover:bg-white"
            onClick={goToPrevious}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-white/80 hover:bg-white"
            onClick={goToNext}
            aria-label="Next image"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {images.map((_, index) => (
              <button
                key={index}
                className={`w-3 h-3 rounded-full ${index === currentImage ? 'bg-white' : 'bg-white/50'}`}
                onClick={() => goToImage(index)}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        </section>

        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">Featured Products</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((product) => (
              <Card key={product}>
                <CardHeader>
                  <CardTitle>Product {product}</CardTitle>
                  <CardDescription>This is a sample product description</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="aspect-square relative bg-muted">
                    <img
                      src={`/placeholder.svg?height=300&width=300&text=Product+${product}`}
                      alt={`Product ${product}`}
                      className="object-cover"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <span className="text-lg font-semibold">${(19.99 * product).toFixed(2)}</span>
                  <Button className="transition-all duration-300 ease-in-out hover:scale-110 hover:bg-green-500 hover:text-white">
                    Add to Cart
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <footer className="bg-muted mt-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-center md:text-left mb-4 md:mb-0">
              <h2 className="text-lg font-semibold">Uwa</h2>
              <p className="text-sm text-muted-foreground">Your one-stop shop for everything</p>
            </div>
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
                <li>
                  <Link href="/faq" className="text-sm text-muted-foreground hover:text-primary">
                    FAQ
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
          <div className="mt-4 flex flex-col md:flex-row justify-between items-center">
            <div className="flex space-x-4 mb-4 md:mb-0">
              <Link href="#" aria-label="Facebook">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-facebook"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </Link>
              <Link href="#" aria-label="Twitter">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-twitter"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
              </Link>
              <Link href="#" aria-label="Instagram">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-instagram"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </Link>
            </div>
            <div className="flex space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-credit-card"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-paypal"><path d="M17.998 8.064c-.127-.474-.372-.918-.726-1.344-.52-.626-1.21-1.037-2.12-1.262-.83-.193-1.885-.305-3.106-.305H7.654L5 18.684h3.303l.656-3.752h2.484c1.185 0 2.092-.076 2.702-.228.832-.206 1.504-.58 2.038-1.124.456-.466.815-1.02 1.074-1.656.26-.637.435-1.48.435-2.024 0-.704-.114-1.306-.4-1.836z"/><path d="M9.95 7.4c1.263 0 2.116.123 2.62.357.52.243.78.687.78 1.346 0 .404-.078.743-.24 1.017a1.83 1.83 0 0 1-.57.63c-.3.21-.67.358-1.11.45-.38.074-1.07.11-2.04.11h-1.75l.47-3.91h1.84z"/></svg>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bitcoin"><path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m3.94.694-.346 1.97"/><path d="M7.116 7.736c3.94.694 4.017-6.242 0-5.547-4.017-.695-3.94 6.241 0 5.547z"/></svg>
            </div>
          </div>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Uwa. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}