import Link from 'next/link'
import Image from 'next/image'
import { ShoppingBag, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const featuredProducts = [
  {
    id: 1,
    name: "Classic Cotton T-Shirt",
    price: 29.99,
    image: "/placeholder.svg?height=300&width=300&text=T-Shirt"
  },
  {
    id: 2,
    name: "Slim Fit Jeans",
    price: 59.99,
    image: "/placeholder.svg?height=300&width=300&text=Jeans"
  },
  {
    id: 3,
    name: "Leather Sneakers",
    price: 89.99,
    image: "/placeholder.svg?height=300&width=300&text=Sneakers"
  },
  {
    id: 4,
    name: "Wool Sweater",
    price: 79.99,
    image: "/placeholder.svg?height=300&width=300&text=Sweater"
  }
]

export default function Home() {
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
            <div className="relative">
              <Button
                variant="ghost"
                className="flex items-center space-x-2"
                aria-haspopup="true"
              >
                <User className="h-5 w-5" />
                <span className="text-sm font-medium">Welcome</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <section className="bg-gray-100 py-12">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl font-bold text-center mb-8">Welcome to Uwa</h1>
            <p className="text-xl text-center mb-8">Discover our latest collection of trendy and comfortable clothing.</p>
            <div className="flex justify-center">
              <Link href="/products">
                <Button className="transition-all duration-300 ease-in-out hover:scale-110 hover:bg-green-500 hover:text-white">
                  Shop Now
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-8">Featured Products</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {featuredProducts.map((product) => (
                <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={300}
                    height={300}
                    className="w-full h-64 object-cover"
                  />
                  <div className="p-4">
                    <h3 className="text-lg font-semibold mb-2">{product.name}</h3>
                    <p className="text-gray-600 mb-4">${product.price.toFixed(2)}</p>
                    <Link href={`/products/${product.id}`}>
                      <Button className="w-full transition-all duration-300 ease-in-out hover:scale-105 hover:bg-green-500 hover:text-white">
                        View Product
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gray-100 py-12">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Subscribe to Our Newsletter</h2>
            <p className="mb-8">Stay updated with our latest offers and new arrivals.</p>
            <form className="max-w-md mx-auto flex">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-grow px-4 py-2 rounded-l-md border-t border-b border-l border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button type="submit" className="rounded-r-md transition-all duration-300 ease-in-out hover:bg-green-500 hover:text-white">
                Subscribe
              </Button>
            </form>
          </div>
        </section>
      </main>

      <footer className="bg-gray-800 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li><Link href="/about" className="hover:text-gray-300">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-gray-300">Contact Us</Link></li>
                <li><Link href="/faq" className="hover:text-gray-300">FAQ</Link></li>
                <li><Link href="/terms" className="hover:text-gray-300">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Follow Us</h3>
              <div className="flex space-x-4">
                <a href="#" className="hover:text-gray-300">Facebook</a>
                <a href="#" className="hover:text-gray-300">Twitter</a>
                <a href="#" className="hover:text-gray-300">Instagram</a>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Contact</h3>
              <p>123 Fashion Street</p>
              <p>Trendy City, TC 12345</p>
              <p>Email: info@uwa.com</p>
              <p>Phone: (123) 456-7890</p>
            </div>
          </div>
          <div className="mt-8 text-center">
            <p>&copy; 2023 Uwa. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}