import Link from 'next/link'
import { Metadata } from 'next'
import { Facebook, Twitter, Linkedin, Instagram } from 'lucide-react'

import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'About Uwa | Your One-Stop Shop',
  description: 'Learn about Uwa, our mission, and the team behind your favorite ecommerce platform.',
}

const teamMembers = [
  {
    name: 'Jane Doe',
    role: 'CEO & Co-founder',
    image: '/placeholder.svg?height=200&width=200&text=Jane+Doe',
    social: {
      twitter: 'https://twitter.com/janedoe',
      linkedin: 'https://linkedin.com/in/janedoe',
    },
  },
  {
    name: 'John Smith',
    role: 'CTO & Co-founder',
    image: '/placeholder.svg?height=200&width=200&text=John+Smith',
    social: {
      twitter: 'https://twitter.com/johnsmith',
      linkedin: 'https://linkedin.com/in/johnsmith',
    },
  },
  {
    name: 'Alex Johnson',
    role: 'COO & Co-founder',
    image: '/placeholder.svg?height=200&width=200&text=Alex+Johnson',
    social: {
      twitter: 'https://twitter.com/alexjohnson',
      linkedin: 'https://linkedin.com/in/alexjohnson',
    },
  },
  {
    name: 'Emily Brown',
    role: 'Head of Customer Experience',
    image: '/placeholder.svg?height=200&width=200&text=Emily+Brown',
    social: {
      twitter: 'https://twitter.com/emilybrown',
      linkedin: 'https://linkedin.com/in/emilybrown',
    },
  },
]

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8">
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
        <Link href="/careers">
          <Button className="transition-all duration-300 ease-in-out hover:scale-105 hover:bg-green-500 hover:text-white">
            View Career Opportunities
          </Button>
        </Link>
      </section>
    </div>
  )
}