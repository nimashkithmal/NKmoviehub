# NKMovieHUB Client

A React-based user management system for NKMovieHUB with authentication, user roles, and admin dashboard.

## Features

- **User Authentication**: Login and registration system
- **Role-based Access Control**: Admin and user roles
- **Admin Dashboard**: Complete user management interface
- **Responsive Design**: Mobile-friendly UI
- **Protected Routes**: Secure access to admin features
- **User Management**: CRUD operations for users

## Components

- `Home.jsx` - Main landing page with user information
- `Login.jsx` - User authentication form
- `Register.jsx` - User registration form
- `AdminDashboard.jsx` - Admin interface for user management
- `Navbar.jsx` - Navigation component
- `AuthContext.js` - Authentication state management

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm start
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```

## Demo Accounts

For testing purposes, you can use these demo accounts:

- **Admin User**: admin@example.com (any password)
- **Regular User**: user@example.com (any password)

## Project Structure

```
src/
├── components/          # React components
│   ├── Home.jsx
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── AdminDashboard.jsx
│   └── Navbar.jsx
├── context/            # React context
│   └── AuthContext.js
├── App.js             # Main application component
├── index.js           # Application entry point
└── index.css          # Global styles
```

## Features Overview

### Authentication System
- JWT-based authentication (simulated)
- Protected routes
- Role-based access control
- Persistent login state

### Admin Dashboard
- User statistics overview
- User management (CRUD operations)
- Search and filter users
- User role management
- User status management

### User Interface
- Modern, responsive design
- Form validation
- Error handling
- Loading states
- Modal dialogs

## Next Steps

This is a frontend-only implementation with mock data. To make it production-ready:

1. **Backend Integration**: Connect to a real API
2. **Database**: Implement user data persistence
3. **Security**: Add proper JWT validation
4. **Testing**: Add unit and integration tests
5. **Deployment**: Configure for production deployment

## Technologies Used

- React 18
- React Router DOM
- Context API for state management
- CSS3 with modern features
- Responsive design principles 