'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Metadata } from 'next'
import { Facebook, Twitter, Linkedin, Instagram, ShoppingBag, User } from 'lucide-react'

import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'About Uwa | Your One-Stop Shop',
  description: 'Learn about Uwa, our mission, and the team behind your favorite ecommerce platform.',
}

const teamMembers = [
  {
    name: 'Confidence Aigbedion',
    role: 'CEO & Co-founder',
    image: '/ppp.png?height=200&width=200&text=Jane+Doe',
    social: {
      twitter: 'https://twitter.com/cconfidence_',
      linkedin: 'https://linkedin.com/in/confidence-aigbedion',
    },
  },
  {
    name: 'Killian Ogah',
    role: 'CTO & Co-founder',
    image: '/Passport.jpg?height=200&width=200&text=John+Smith',
    social: {
      twitter: 'https://twitter.com/johnsmith',
      linkedin: 'https://linkedin.com/in/johnsmith',
    },
  },
  {
    name: 'Ofure Edeawe',
    role: 'COO',
    image: '/jj.jpeg?height=200&width=200&text=Alex+Johnson',
    social: {
      twitter: 'https://twitter.com/alexjohnson',
      linkedin: 'https://linkedin.com/in/alexjohnson',
    },
  },
  {
    name: 'Victory Ehinomen',
    role: 'Head of Customer Experience',
    image: '/Kris.jpeg?height=200&width=200&text=Emily+Brown',
    social: {
      twitter: 'https://twitter.com/emilybrown',
      linkedin: 'https://linkedin.com/in/emilybrown',
    },
  },
]

export default function AboutPage() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

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

      <div className="container mx-auto px-4 py-8 flex-grow">
        <h1 className="text-4xl font-bold text-center mb-8">About Uwa</h1>
        
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Our Story</h2>
          <p className="text-lg mb-4">
            Uwa was founded in 2023 with a simple mission: to create a seamless online shopping experience for customers worldwide. Our journey began when a group of tech enthusiasts and retail experts came together, united by the vision of revolutionizing e-commerce.
          </p>
          <p className="text-lg mb-4">
            Today, Uwa has grown into a leading online marketplace, offering a wide range of products from trusted sellers and brands. We're committed to innovation, customer satisfaction, and supporting small businesses in the digital age.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Our Mission</h2>
          <p className="text-lg mb-4">
            At Uwa, our mission is to connect buyers with sellers in a trusted, efficient, and user-friendly online environment. We strive to:
          </p>
          <ul className="list-disc list-inside text-lg mb-4 space-y-2">
            <li>Offer a diverse range of high-quality products at competitive prices</li>
            <li>Provide exceptional customer service and support</li>
            <li>Empower small businesses and entrepreneurs to reach a global audience</li>
            <li>Continuously innovate and improve our platform for a better shopping experience</li>
            <li>Promote sustainable and ethical business practices</li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Our Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {teamMembers.map((member) => (
              <div key={member.name} className="text-center">
                <img src={member.image} alt={member.name} className="w-48 h-48 rounded-full mx-auto mb-4" />
                <h3 className="text-xl font-semibold">{member.name}</h3>
                <p className="text-gray-600 mb-2">{member.role}</p>
                <div className="flex justify-center space-x-2">
                  {member.social.twitter && (
                    <a href={member.social.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-primary">
                      <Twitter size={20} />
                      <span className="sr-only">Twitter</span>
                    </a>
                  )}
                  {member.social.linkedin && (
                    <a href={member.social.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-primary">
                      <Linkedin size={20} />
                      <span className="sr-only">LinkedIn</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Join Our Journey</h2>
          <p className="text-lg mb-6">
            We're always looking for talented individuals to join our team and help shape the future of e-commerce.
          </p>
          <Link href="https://c4confidence.github.io/Rejoin/">
            <Button className="transition-all duration-300 ease-in-out hover:scale-105 hover:bg-green-500 hover:text-white">
              View Career Opportunities
            </Button>
          </Link>
        </section>
      </div>
    </div>
  )
}