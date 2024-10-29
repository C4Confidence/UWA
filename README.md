# UWA eCommerce Site

UWA is a full-stack eCommerce web application built to provide a seamless shopping experience for users. With a modern, responsive design, UWA enables users to browse products, add items to a cart, make purchases, and receive email notifications. It is built using Next.js for the frontend, Node.js for the backend, MongoDB as the database, and integrated with Redis for caching.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
- [Usage](#usage)
  - [Running the Development Server](#running-the-development-server)
  - [Testing](#testing)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Product Listings**: Browse available products with detailed descriptions and images.
- **User Authentication**: Secure login and account creation for users.
- **Product Search**: Search for products by keywords.
- **Shopping Cart**: Add, update, or remove items from the shopping cart.
- **Checkout**: Complete orders with integrated payment options.
- **Order History**: View past orders.
- **Admin Panel**: For managing products, orders, and users.
- **Email Notifications**: Automated email confirmations for orders.
- **Caching**: Redis caching for faster data retrieval.
- **Responsive Design**: Optimized for both desktop and mobile devices.

## Tech Stack

- **Frontend**: Next.js, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: MongoDB
- **Caching**: Redis
- **API Testing**: Postman
- **Email Service**: Nodemailer

## Getting Started

### Prerequisites

Ensure you have the following installed:
- Node.js
- MongoDB
- Redis
- Yarn or npm

### Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/C4Confidence/UWA.git
   cd UWA


Install Dependencies

Using Yarn:
yarn install

Or with npm:
npm install
Configure MongoDB and Redis

Make sure MongoDB and Redis servers are running on your machine.

Environment Variables
Create a .env file in the root directory and add the following variables:

PORT=5000
MONGODB_URI=mongodb://localhost:27017/uwa_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_secret_key
EMAIL_HOST=smtp.your-email-provider.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password
Usage

Running the Development Server
To start the server in development mode:

yarn dev

Or with npm:
npm run dev

The application should now be accessible at http://localhost:3000.

Testing
API Testing: Open Postman and import the UWA.postman_collection.json (provided in the repo).

Unit Tests: Run the following command:
yarn test

API Documentation
The UWA API allows for programmatic access to products, user accounts, and order management. The main endpoints include:

Authentication

POST /api/auth/login
POST /api/auth/register

Products
GET /api/products - Get all products
GET /api/products/:id - Get a single product by ID

Cart
POST /api/cart - Add an item to the cart
GET /api/cart - Get items in the cart

Orders
POST /api/orders - Create a new order
GET /api/orders/:id - Get order details

Admin
POST /api/admin/products - Add a new product
DELETE /api/admin/products/:id - Delete a product by ID
For more details on the API, refer to the Postman collection provided in the repository.

Project Structure
uwa/
├── public/                  # Public assets
├── frontend/
│   ├── components/          # Reusable UI components
│   ├── pages/               # Next.js pages
│   ├── api/                 # API route handlers
│   ├── models/              # Mongoose models
│   ├── middleware/          # Middleware for authentication, etc.
│   ├── utils/               # Utility functions
│   ├── config/              # Configuration files (e.g., database)
│   └── styles/              # Tailwind CSS configurations
├── .env                     # Environment variables
├── package.json             # Project dependencies and scripts
└── README.md                # Project documentation

Contributing
Contributions are welcome! Please follow these steps:

Fork the repository.
Create a feature branch: git checkout -b feature-name
Commit your changes: git commit -m 'Add new feature'
Push to the branch: git push origin feature-name
Open a pull request.
Please ensure your code adheres to the coding standards of the project.

License
This project is licensed under the MIT License. See the LICENSE file for more information.

This `README.md` covers key aspects of the UWA project, including setup, usage, API documentation, and project structure. You can modify it as needed based on any additional features or specific requirements for your project.
