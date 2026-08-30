# AI Development Workflow

This document outlines the AI-driven workflow used to architect and build the Food Delivery project.

## 1. Requirement Analysis & Planning
- **Goal**: Create a scalable food delivery system with separate interfaces for customers and admins.
- **Tech Stack Selection**: 
    - Frontend: React.js, Vite, CSS3.
    - Backend: Node.js, Express.js.
    - Database: MongoDB.
    - Auth: JWT, Bcrypt.

## 2. Backend Development (The Core)
- **Schema Design**: Defined Mongoose models for `User`, `Food`, and `Order`.
- **API Implementation**:
    - `userController`: Handled registration, login, and token generation.
    - `foodController`: Implemented CRUD operations for food items with admin validation.
    - `orderController`: Managed order placement, payment verification, and status updates.
    - `cartController`: Managed user-specific cart data in MongoDB.
- **Security**: Implemented `auth.js` middleware to protect admin routes.

## 3. Frontend Engineering
- **Customer App**:
    - State management via `StoreContext` for cart and token handling.
    - Routing using `react-router-dom` for Home, Cart, Order, and MyOrders pages.
    - Integration with backend APIs for real-time data fetching.
- **Admin App**:
    - Specialized routes for adding food and managing orders.
    - Image upload handling via `multer` on the backend.

## 4. Iterative Refinement
- **Payment Simplification**: Identified Stripe as a bottleneck for the current scope and pivoted to a simplified verification flow.
- **UI/UX Polish**: Added `react-toastify` for user notifications and refined CSS for a modern look.

## 5. Deployment Strategy
- **Backend**: Deployed to vercel.
- **Frontend**: Deployed to Vercel.
- **Database**: Hosted on MongoDB Atlas.

